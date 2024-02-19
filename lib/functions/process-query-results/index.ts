import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger();

/**
 * This function converts data values from VarCharValue to their original data type.
 *
 * @param data - The data to be converted to the specified data type.
 * @param dataType - The data type to be converted to.
 */
function convertData(data: string, dataType: string): any {
  switch (dataType) {
  case 'bigint':
    return parseInt(data);
  case 'double':
    return parseFloat(data);
  case 'boolean':
    return data === 'true';
  default:
    return data;
  }
}

/**
 * This function is called when a query is executed. It extracts the results from the query and returns them.
 *
 * @param event - The event object passed to the Lambda function. This object contains information about the query results.
 * @returns {Promise<{results: {[key: string]: any}}>} - Returns an object containing the results of the query.
 */
export const handler = async (event: any): Promise<{ results: { [key: string]: any } }> => {
  const results: { [key: string]: any } = {};
  if (!event) {
    logger.error('Error: No event found');
    return { results };
  }

  const { ObjectKey, ResultSet } = event;
  if (!ObjectKey || !ResultSet) {
    logger.error('Error: No ObjectKey or ResultSet found in event');
    return { results };
  }

  logger.info(`Starting to process query results from: ${ObjectKey}`);

  try {
    const { ResultSetMetadata, Rows } = ResultSet;
    const { ColumnInfo } = ResultSetMetadata;

    if (Rows && Rows.length === 2) {
      const columnNames = Rows[0].Data.map((value: { VarCharValue: string }) => value.VarCharValue);
      const values = Rows[1].Data.map((value: { VarCharValue: string }) => value.VarCharValue);

      for (let index = 0; index < values.length; index++) {
        if (ResultSetMetadata) {
          values[index] = convertData(values[index], ColumnInfo[index].Type);
        }
        results[columnNames[index]] = values[index];
      }
    } else if (Rows && Rows.length > 2) {
      logger.error(`Error: ResultSet should have 2 rows but it has ${Rows.length} rows`);
    } else {
      logger.error('Error: ResultSet is empty or does not have enough rows');
    }
  } catch (error) {
    logger.error(`Error: ${error}`);
  }

  logger.info(`Finished processing query results from: ${ObjectKey}`);
  return {
    results: results
  };
};

import { Logger } from '@aws-lambda-powertools/logger';
import { processQueryResultsHandler } from '../../lib/functions/index';

/**
 * Unit tests for process-query-results {@link handler} function.
 */
describe('handler', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(Logger.prototype, 'info');
    jest.spyOn(Logger.prototype, 'error');
  });

  test('handles valid input', async () => {
    const event = {
      resultSet: {
        ResultSetMetadata: {
          ColumnInfo: [
            { Name: 'col1', Type: 'bigint' },
            { Name: 'col2', Type: 'double' },
            { Name: 'col3', Type: 'boolean' },
            { Name: 'col4', Type: 'string' }
          ]
        },
        Rows: [
          { Data: [{ VarCharValue: 'col1' }, { VarCharValue: 'col2' }, { VarCharValue: 'col3' }, { VarCharValue: 'col4' }] },
          { Data: [{ VarCharValue: '2' }, { VarCharValue: '6.28' }, { VarCharValue: 'false' }, { VarCharValue: 'test' }] }
        ]
      },
      queryExecutionId: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX'
    };

    const result = await processQueryResultsHandler(event);

    expect(result.results).toEqual({
      col1: 2,
      col2: 6.28,
      col3: false,
      col4: 'test'
    });
    expect(Logger.prototype.info).toHaveBeenCalledTimes(2);
    expect(Logger.prototype.info).toHaveBeenCalledWith(`Starting to process results from query execution id: ${event.queryExecutionId}`);
    expect(Logger.prototype.info).toHaveBeenCalledWith(`Finished processing results from query execution id: ${event.queryExecutionId}`);
  });

  test('handles empty result set data', async () => {
    const event = {
      resultSet: {
        ResultSetMetadata: {
          ColumnInfo: []
        },
        Rows: []
      },
      queryExecutionId: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX'
    };
    const result = await processQueryResultsHandler(event);

    expect(result.results).toEqual({});
    expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
    expect(Logger.prototype.error).toHaveBeenCalledWith('Error: Result set is empty or does not have enough rows');
  });

  test('handles missing column info', async () => {
    const event = {
      resultSet: {
        ResultSetMetadata: null,
        Rows: []
      },
      queryExecutionId: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX'
    };

    const result = await processQueryResultsHandler(event);

    expect(result.results).toEqual({});
    expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
  });

  test('handles invalid result set data', async () => {
    const event = {
      resultSet: {
        ResultSetMetadata: {
          ColumnInfo: [
            { Name: 'col1', Type: 'bigint' },
            { Name: 'col2', Type: 'double' },
            { Name: 'col3', Type: 'boolean' },
            { Name: 'col4', Type: 'string' }
          ]
        },
        Rows: [
          { Data: [{ VarCharValue: 'col1' }, { VarCharValue: 'col2' }, { VarCharValue: 'col3' }, { VarCharValue: 'col4' }] },
          { Data: [{ VarCharValue: '2' }, { VarCharValue: '6.28' }, { VarCharValue: 'false' }, { VarCharValue: 'test' }] },
          { Data: [{ VarCharValue: '4' }, { VarCharValue: '8' }, { VarCharValue: 'true' }, { VarCharValue: 'value' }] }
        ]
      },
      queryExecutionId: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX'
    };

    const result = await processQueryResultsHandler(event);

    expect(result.results).toEqual({});
    expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
    expect(Logger.prototype.error).toHaveBeenCalledWith('Error: Result set should have 2 rows but it has 3 rows');
  });

  test('handles null event', async () => {
    const result = await processQueryResultsHandler(null);

    expect(result.results).toEqual({});
    expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
    expect(Logger.prototype.error).toHaveBeenCalledWith('Error: No event found');
  });

  test('handles missing result set data', async () => {
    const result = await processQueryResultsHandler({
      queryExecutionId: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX'
    });

    expect(result.results).toEqual({});
    expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
    expect(Logger.prototype.error).toHaveBeenCalledWith('Error: No query execution id or result set found in event');
  });

  test('handles missing query execution id', async () => {
    const result = await processQueryResultsHandler({});

    expect(result.results).toEqual({});
    expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
    expect(Logger.prototype.error).toHaveBeenCalledWith('Error: No query execution id or result set found in event');
  });
});

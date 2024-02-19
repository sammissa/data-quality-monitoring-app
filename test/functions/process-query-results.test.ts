import { Logger } from '@aws-lambda-powertools/logger';
import { handler } from '../../lib/functions/process-query-results';

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
      ResultSet: {
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
      ObjectKey: 'test-object-key'
    };

    const result = await handler(event);

    expect(result.results).toEqual({
      col1: 2,
      col2: 6.28,
      col3: false,
      col4: 'test'
    });
    expect(Logger.prototype.info).toHaveBeenCalledTimes(2);
    expect(Logger.prototype.info).toHaveBeenCalledWith(`Starting to process query results from: ${event.ObjectKey}`);
    expect(Logger.prototype.info).toHaveBeenCalledWith(`Finished processing query results from: ${event.ObjectKey}`);
  });

  test('handles empty result set data', async () => {
    const event = {
      ResultSet: {
        ResultSetMetadata: {
          ColumnInfo: []
        },
        Rows: []
      },
      ObjectKey: 'test-object-key'
    };
    const result = await handler(event);

    expect(result.results).toEqual({});
    expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
    expect(Logger.prototype.error).toHaveBeenCalledWith('Error: ResultSet is empty or does not have enough rows');
  });

  test('handles missing column info', async () => {
    const event = {
      ResultSet: {
        ResultSetMetadata: null,
        Rows: []
      },
      ObjectKey: 'test-object-key'
    };

    const result = await handler(event);

    expect(result.results).toEqual({});
    expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
  });

  test('handles invalid result set data', async () => {
    const event = {
      ResultSet: {
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
      ObjectKey: 'test-object-key'
    };

    const result = await handler(event);

    expect(result.results).toEqual({});
    expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
    expect(Logger.prototype.error).toHaveBeenCalledWith('Error: ResultSet should have 2 rows but it has 3 rows');
  });

  test('handles null event', async () => {
    const result = await handler(null);

    expect(result.results).toEqual({});
    expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
    expect(Logger.prototype.error).toHaveBeenCalledWith('Error: No event found');
  });

  test('handles missing result set data', async () => {
    const result = await handler({
      ObjectKey: 'test-object-key'
    });

    expect(result.results).toEqual({});
    expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
    expect(Logger.prototype.error).toHaveBeenCalledWith('Error: No ObjectKey or ResultSet found in event');
  });

  test('handles missing object key', async () => {
    const result = await handler({});

    expect(result.results).toEqual({});
    expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
    expect(Logger.prototype.error).toHaveBeenCalledWith('Error: No ObjectKey or ResultSet found in event');
  });
});

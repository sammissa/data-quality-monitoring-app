import { App, Stack } from 'aws-cdk-lib';
import { Athena } from '../../lib/constructs/athena';
import { ResultPath } from '../../lib/constants';
import { Template } from 'aws-cdk-lib/assertions';

/**
 * Unit tests for the {@link Athena} class.
 */
describe('Athena', () => {
  let stack: Stack;
  let athenaConstruct: Athena;
  let template: Template;

  beforeAll(() => {
    // Arrange
    const app = new App();
    stack = new Stack(app, 'TestStack');

    const athenaProps = {
      stage: '',
      bucketName: 'test-bucket',
      contentProviderPath: 'test-content-provider',
      databaseName: 'test_database'
    };

    // Act
    athenaConstruct = new Athena(stack, 'TestAthena', athenaProps);
    template = Template.fromStack(stack);
  });

  test('creates the right number of resources', () => {
    // Assert
    template.resourceCountIs('AWS::Athena::WorkGroup', 1);
  });

  test('creates an athena workgroup with the correct properties', () => {
    const expectedAthenaWorkgroupProps = {
      Name: 'test-content-provider-AthenaWorkgroup',
      RecursiveDeleteOption: true,
      State: 'ENABLED',
      WorkGroupConfiguration: {
        EnforceWorkGroupConfiguration: true,
        ResultConfiguration: {
          OutputLocation: 's3://test-bucket/test-content-provider/'
        }
      }
    };

    // Assert
    template.hasResourceProperties('AWS::Athena::WorkGroup', expectedAthenaWorkgroupProps);
  });

  test('getExecutionParameters returns a pass state with the correct properties', () => {
    const expectedTaskProps = {
      End: true,
      Parameters: {
        'executionParameters.$': 'States.Array(States.ArrayGetItem(States.StringSplit($$.Execution.Input.detail.object.key, \'/\'), 1))'
      },
      Type: 'Pass',
      ResultPath: ResultPath.ATHENA
    };

    const getExecutionParametersPass = athenaConstruct.getExecutionParameters('TestGetExecutionParameters');

    // Assert
    expect(stack.resolve(getExecutionParametersPass.toStateJson())).toEqual(expectedTaskProps);
  });

  test('startQueryExecution returns a task state with the correct properties', () => {
    const expectedTaskProps = {
      End: true,
      Parameters: {
        'ExecutionParameters.$': `${ResultPath.ATHENA}.executionParameters`,
        QueryExecutionContext: {
          Database: 'test_database'
        },
        QueryString: 'SELECT keyword FROM test_database.test_content_provider WHERE partition_0 = ?',
        ResultConfiguration: {},
        WorkGroup: 'test-content-provider-AthenaWorkgroup'
      },
      Type: 'Task',
      ResultPath: `${ResultPath.ATHENA}.startQueryExecution`,
      ResultSelector: {
        'outputLocation.$': '$.QueryExecution.ResultConfiguration.OutputLocation',
        'queryExecutionId.$': '$.QueryExecution.QueryExecutionId'
      },
      Resource: {
        'Fn::Join': [
          '',
          [
            'arn:',
            {
              'Ref': 'AWS::Partition'
            },

            ':states:::athena:startQueryExecution.sync'
          ]
        ]
      }
    };

    const startQueryExecutionTask = athenaConstruct.startQueryExecution('TestStartQueryExecution');
    // Assert
    expect(stack.resolve(startQueryExecutionTask.toStateJson())).toEqual(expectedTaskProps);
  });

  test('getQueryResults returns a task state with the correct properties', () => {
    const expectedTaskProps = {
      End: true,
      Parameters: {
        'QueryExecutionId.$': `${ResultPath.ATHENA}.startQueryExecution.queryExecutionId`
      },
      Type: 'Task',
      ResultPath: `${ResultPath.ATHENA}.getQueryResults`,
      ResultSelector: {
        'resultSet.$': '$.ResultSet'
      },
      Resource: {
        'Fn::Join': [
          '',
          [
            'arn:',
            {
              'Ref': 'AWS::Partition'
            },

            ':states:::athena:getQueryResults'
          ]
        ]
      }
    };

    const getQueryResultsTask = athenaConstruct.getQueryResults('TestGetQueryResults');
    // Assert
    expect(stack.resolve(getQueryResultsTask.toStateJson())).toEqual(expectedTaskProps);
  });
});
import { App, Stack } from 'aws-cdk-lib';
import { Lambda } from '../../lib/constructs/lambda';
import { ResultPath } from '../../lib/constants';
import { Template } from 'aws-cdk-lib/assertions';

/**
 * Unit tests for the {@link Lambda} class.
 */
describe('Lambda', () => {
  let stack: Stack;
  let lambdaConstruct: Lambda;
  let template: Template;

  beforeAll(() => {
    // Arrange
    const app = new App();
    stack = new Stack(app, 'TestStack');

    const lambdaProps = {
      contentProviderPath: 'test-content-provider',
      stage: ''
    };

    // Act
    lambdaConstruct = new Lambda(stack, 'TestLambda', lambdaProps);
    template = Template.fromStack(stack);
  });

  test('creates the right number of resources', () => {
    // Assert
    template.resourceCountIs('AWS::Lambda::Function', 1);
    template.resourceCountIs('AWS::IAM::Role', 1);
    template.resourceCountIs('AWS::Logs::LogGroup', 1);
  });


  test('creates a lambda function with the correct properties', () => {
    const expectedLambdaFunctionProps = {
      Environment: {
        Variables: {
          AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1'
        }
      },
      FunctionName: 'test-content-provider-LambdaFunction',
      Handler: 'index.handler',
      Runtime: 'nodejs18.x',
      Timeout: 30
    };

    // Assert
    template.hasResourceProperties('AWS::Lambda::Function', expectedLambdaFunctionProps);
  });

  test('creates a iam role with the correct properties', () => {
    const expectedIamRoleProps = {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: {
              Service: 'lambda.amazonaws.com'
            }
          }
        ],
        Version: '2012-10-17'
      },
      ManagedPolicyArns: [
        {
          'Fn::Join': [
            '',
            [
              'arn:',
              {
                Ref: 'AWS::Partition'
              },
              ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
            ]
          ]
        }
      ]
    };

    // Assert
    template.hasResourceProperties('AWS::IAM::Role', expectedIamRoleProps);
  });

  test('creates a log group with the correct properties', () => {
    const expectedLogGroupProps = {
      LogGroupName: '/aws/lambda/test-content-provider-LambdaLog',
      RetentionInDays: 1
    };

    // Assert
    template.hasResourceProperties('AWS::Logs::LogGroup', expectedLogGroupProps);
  });

  test('invoke returns a lambdaInvoke task with the correct task definition', () => {
    const expectedTaskProps = {
      End: true,
      Parameters: {
        FunctionName: {
          'Fn::GetAtt': [
            'TestLambda70F93640',
            'Arn'
          ]
        },
        Payload: {
          'ResultSet.$': `${ResultPath.ATHENA_GET_QUERY_RESULTS}.resultSet`,
          'ObjectKey.$': `${ResultPath.EXECUTION_INPUT}.key`
        }
      },
      ResultPath: ResultPath.LAMBDA_INVOKE,
      ResultSelector: {
        'results.$': '$.Payload.results'
      },
      Retry: [
        {
          ErrorEquals: [
            'Lambda.ClientExecutionTimeoutException',
            'Lambda.ServiceException',
            'Lambda.AWSLambdaException',
            'Lambda.SdkClientException'
          ],
          IntervalSeconds: 2,
          MaxAttempts: 6,
          BackoffRate: 2
        }
      ],
      Resource: {
        'Fn::Join': [
          '',
          [
            'arn:',
            {
              Ref: 'AWS::Partition'
            },
            ':states:::lambda:invoke'
          ]
        ]
      },
      Type: 'Task'
    };

    const lambdaInvokeTask = lambdaConstruct.invoke('TestInvoke');
    // Assert
    expect(stack.resolve(lambdaInvokeTask.toStateJson())).toEqual(expectedTaskProps);
  });
});

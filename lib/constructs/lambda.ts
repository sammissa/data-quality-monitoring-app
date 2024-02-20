import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { TaskInput } from 'aws-cdk-lib/aws-stepfunctions';

/**
 * Properties for Lambda construct.
 *
 * @param {string} contentProviderPath - Path to the content provider data files
 * @param {string} stage - Stage of the stack
 */
export interface LambdaProps {
  readonly contentProviderPath: string;
  readonly stage: string;
}

/**
 * Construct to create an AWS Lambda function and related resources.
 *
 * @param {Construct} scope - Scope in which this construct is defined
 * @param {string} id - ID of the construct
 * @param {LambdaProps} props - Properties of the construct
 */
export class Lambda extends Construct {
  private readonly lambdaFunction: NodejsFunction;

  constructor(scope: Construct, id: string, props: LambdaProps) {
    super(scope, id);

    const lambdaRole = new Role(this, 'Role', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com')
    });
    lambdaRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'));

    new LogGroup(this, 'LogGroup', {
      logGroupName: `/aws/lambda/${props.contentProviderPath}-${props.stage}LambdaLog`,
      retention: 1,
      removalPolicy: RemovalPolicy.DESTROY
    });

    this.lambdaFunction = new NodejsFunction(this, id, {
      functionName: `${props.contentProviderPath}-${props.stage}LambdaFunction`,
      entry: './lib/functions/process-query-results/index.ts',
      handler: 'handler',
      runtime: Runtime.NODEJS_18_X,
      role: lambdaRole,
      timeout: Duration.seconds(30),
      bundling: {
        nodeModules: [
          '@aws-lambda-powertools/logger'
        ]
      }
    });
  }

  /**
   * Invokes the Lambda function in a Step Function task.
   *
   * @param {string} id - Logical ID for the task
   * @returns {LambdaInvoke}
   */
  public invoke(id: string): LambdaInvoke {
    return new LambdaInvoke(this, id, {
      lambdaFunction: this.lambdaFunction,
      payload: TaskInput.fromObject(
        {
          'ResultSet.$': '$.ResultSet',
          'ObjectKey.$': '$$.Execution.Input.detail.object.key'
        })
    });
  }
}
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { TaskInput } from 'aws-cdk-lib/aws-stepfunctions';

export interface LambdaProps {
  readonly contentProviderPath: string;
  readonly stage: string;
}

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
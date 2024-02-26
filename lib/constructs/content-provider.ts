import { Chain, Choice, Condition, DefinitionBody, Fail, StateMachine, Succeed, Wait, WaitTime } from 'aws-cdk-lib/aws-stepfunctions';
import { Athena } from './athena';
import { Construct } from 'constructs';
import { Database } from './database';
import { Duration } from 'aws-cdk-lib';
import { Glue } from './glue';
import { Lambda } from './lambda';
import { ResultPath } from '../constants';
import { Rule } from 'aws-cdk-lib/aws-events';
import { S3 } from './s3';
import { SNS } from './sns';
import { SfnStateMachine } from 'aws-cdk-lib/aws-events-targets';

/**
 * Properties for ContentProvider construct.
 *
 * @param {string} accountId - AWS Account ID of the stack
 * @param {string} region - AWS Region of the stack
 * @param {string} stage - Stage of the stack
 * @param {S3} s3Construct - Construct containing s3 bucket resource properties.
 * @param {string} contentProviderPath - Path to the content provider data files
 * @param {Database} databaseConstruct - Construct containing glue database resource properties.
 */
export interface ContentProviderProps {
  readonly accountId: string;
  readonly region: string;
  readonly stage: string;
  readonly s3Construct: S3;
  readonly contentProviderPath: string;
  readonly databaseConstruct: Database;
}

/**
 * Construct to create a content provider. This construct creates an AWS Glue crawler, an AWS Athena Workgroup,
 * an AWS Lambda function, and an AWS SNS topic. It also creates an AWS Step Functions state machine that orchestrates
 * the crawler, Athena, and Lambda functions. The state machine is triggered by S3 events when new content is uploaded
 * to the input bucket. The state machine also publishes an SNS message when the crawler finishes running.
 *
 * @param {Construct} scope - Scope in which this construct is defined
 * @param {string} id - ID of the construct
 * @param {DatabaseProps} props - Properties of the construct
 */
export class ContentProvider extends Construct {
  private readonly glueConstruct: Glue;
  private readonly athenaConstruct: Athena;
  private readonly lambdaConstruct: Lambda;
  private readonly snsConstruct: SNS;

  constructor(scope: Construct, id: string, props: ContentProviderProps) {
    super(scope, id);

    this.glueConstruct = new Glue(this, 'Glue', {
      accountId: props.accountId,
      region: props.region,
      stage: props.stage,
      bucket: props.s3Construct.inputBucket,
      contentProviderPath: props.contentProviderPath,
      databaseName: props.databaseConstruct.databaseName
    });

    this.athenaConstruct = new Athena(this, 'Athena', {
      bucketName: props.s3Construct.outputBucket.bucketName,
      contentProviderPath: props.contentProviderPath,
      databaseName: props.databaseConstruct.databaseName,
      stage: props.stage
    });

    this.lambdaConstruct = new Lambda(this, 'Lambda', {
      contentProviderPath: props.contentProviderPath,
      stage: props.stage
    });

    this.snsConstruct = new SNS(this, 'SNS', {
      contentProviderPath: props.contentProviderPath,
      stage: props.stage
    });

    const stepFunction = new StateMachine(this, id, {
      definitionBody: DefinitionBody.fromChainable(
        this.getDefinitionBodyChain()
      ),
      timeout: Duration.minutes(5)
    });

    new Rule(this, 'EventsRule', {
      targets: [ new SfnStateMachine(stepFunction) ],
      eventPattern: {
        source: [ 'aws.s3' ],
        detailType: [ 'Object Created' ],
        detail: {
          bucket: {
            name: [ props.s3Construct.inputBucket.bucketName ]
          },
          object: {
            key: [ { prefix: props.contentProviderPath } ]
          }
        }
      }
    });
  }

  private getSuccessTaskChain(): Chain {
    const publishSuccessTopicTask = this.snsConstruct.publishSuccessTopic('SNS Task - Publish Success Topic');
    const success = new Succeed(this, 'Success');

    return Chain.start(publishSuccessTopicTask)
      .next(success);
  }

  private getFailTaskChain(): Chain {
    const publishFailTopicTask = this.snsConstruct.publishFailTopic('SNS Task - Publish Fail Topic');
    const fail = new Fail(this, 'Fail', {
      error: 'Query failed'
    });

    return Chain.start(publishFailTopicTask)
      .next(fail);
  }

  private getQueryTaskChain(): Chain {
    const getExecutionParameters = this.athenaConstruct.getExecutionParameters('Athena Pass - Get Execution Parameters');
    const startQueryExecution = this.athenaConstruct.startQueryExecution('Athena Task - Start Query Execution');
    const getQueryResults = this.athenaConstruct.getQueryResults('Athena Task - Get Query Results');
    const processQueryResults = this.lambdaConstruct.invoke('Lambda Task - Process Query Results');

    const checkQueryResults = new Choice(this, 'State Choice - Check Query Results')
      .when(Condition.booleanEquals(`${ResultPath.LAMBDA}.results.success`, true), this.getSuccessTaskChain())
      .otherwise(this.getFailTaskChain());

    return Chain.start(getExecutionParameters)
      .next(startQueryExecution)
      .next(getQueryResults)
      .next(processQueryResults)
      .next(checkQueryResults);
  }

  private getDefinitionBodyChain(): Chain {
    const startGlueCrawler = this.glueConstruct.callService('Glue Task - Start Glue Crawler', 'startCrawler', 'glue:StartCrawler');
    const getGlueCrawler = this.glueConstruct.callService('Glue Task - Get Glue Crawler', 'getCrawler', 'glue:GetCrawler');

    const wait = new Wait(this, 'State Wait - Wait for Glue Crawler', {
      time: WaitTime.duration(Duration.seconds(30))
    });
    const waitTaskChain = Chain.start(wait)
      .next(getGlueCrawler);

    const checkGlueCrawler = new Choice(this, 'State Choice - Check Glue Crawler')
      .when(Condition.stringEquals(`${ResultPath.GLUE}.Crawler.State`, 'RUNNING'), waitTaskChain)
      .otherwise(this.getQueryTaskChain());

    return Chain.start(startGlueCrawler)
      .next(getGlueCrawler)
      .next(checkGlueCrawler);
  }
}

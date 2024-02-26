import { CfnClassifier, CfnCrawler } from 'aws-cdk-lib/aws-glue';
import { Effect, ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { CallAwsService } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';
import { ResultPath } from '../constants';

/**
 * Properties for Glue construct.
 *
 * @param {string} accountId - AWS Account ID of the stack
 * @param {string} region - AWS Region of the stack
 * @param {string} stage - Stage of the stack
 * @param {string} bucket - Input s3 bucket containing content provider data files
 * @param {string} contentProviderPath - Path to the content provider data files
 * @param {string} databaseName - Name of the Glue Database
 */
export interface GlueProps {
  readonly accountId: string;
  readonly region: string;
  readonly stage: string;
  readonly bucket: Bucket;
  readonly contentProviderPath: string;
  readonly databaseName: string;
}

/**
 * Construct to create an AWS Glue crawler and related resources.
 *
 * @param {Construct} scope - Scope in which this construct is defined
 * @param {string} id - ID of the construct
 * @param {GlueProps} props - Properties of the construct
 */
export class Glue extends Construct {
  private readonly accountId: string;
  private readonly region: string;
  private readonly crawler: CfnCrawler;

  constructor(scope: Construct, id: string, props: GlueProps) {
    super(scope, id);

    this.accountId = props.accountId;
    this.region = props.region;

    const crawlerRole = new Role(this, 'Role', {
      assumedBy: new ServicePrincipal('glue.amazonaws.com')
    });
    crawlerRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole'));
    crawlerRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        resources: [ '*' ],
        actions: [ 'glue:*', 's3:*' ]
      })
    );
    props.bucket.grantRead(crawlerRole, props.contentProviderPath + '/*');

    const classifierName = `${props.contentProviderPath}-${props.stage}GlueClassifier`;
    new CfnClassifier(this, 'Classifier', {
      csvClassifier: {
        allowSingleColumn: false,
        containsHeader: 'PRESENT',
        delimiter: ',',
        disableValueTrimming: true,
        name: classifierName,
        quoteSymbol: '"'
      }
    });

    this.crawler = new CfnCrawler(this, 'Crawler', {
      name: `${props.contentProviderPath}-${props.stage}GlueCrawler`,
      role: crawlerRole.roleArn,
      databaseName: props.databaseName,
      targets: {
        s3Targets: [
          {
            path: `s3://${props.bucket.bucketName}/${props.contentProviderPath}/`
          }
        ]
      },
      schemaChangePolicy: {
        deleteBehavior: 'LOG', //'DELETE_FROM_DATABASE'
        updateBehavior: 'LOG' //'UPDATE_IN_DATABASE'
      },
      recrawlPolicy: {
        recrawlBehavior: 'CRAWL_NEW_FOLDERS_ONLY' //'CRAWL_EVERYTHING'
      },
      classifiers: [ classifierName ],
      configuration: JSON.stringify({
        Version: 1,
        CrawlerOutput: {
          Partitions: {
            AddOrUpdateBehavior: 'InheritFromTable'
          }
        },
        Grouping: {
          TableGroupingPolicy: 'CombineCompatibleSchemas'
        }
      })
    });
  }

  /**
   * Call an AWS Glue service API in a Step Function task.
   *
   * @param {string} id - Logical ID for the task
   * @param {string} action - The Glue API action
   * @param {string} iamAction - The IAM permission needed
   * @returns {CallAwsService}
   */
  public callService(id: string, action: string, iamAction: string): CallAwsService {
    return new CallAwsService(this, id, {
      service: 'glue',
      action: action,
      parameters: { Name: this.crawler.name },
      iamResources: [
        `arn:aws:glue:${this.region}:${this.accountId}:crawler/${this.crawler.name}`
      ],
      iamAction: iamAction,
      resultPath: ResultPath.GLUE
    });
  }
}

import { Effect, ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { CallAwsService } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { CfnCrawler } from 'aws-cdk-lib/aws-glue';
import { Construct } from 'constructs';

/**
 * Properties for the Glue construct.
 *
 * @param {string} accountId - AWS Account ID of the stack
 * @param {string} region - AWS Region of the stack
 * @param {string} bucket - Input s3 bucket containing content provider data files
 * @param {string} contentProviderPath - Path to the content provider data files
 * @param {string} databaseName - Name of the Glue Database
 */
export interface GlueProps {
  readonly accountId: string;
  readonly region: string;
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

    const bucketName = props.bucket.bucketName;
    this.crawler = new CfnCrawler(this, 'Crawler', {
      name: `${props.contentProviderPath}-GlueCrawler`,
      role: crawlerRole.roleArn,
      databaseName: props.databaseName,
      targets: {
        s3Targets: [
          {
            path: `s3://${bucketName}/${props.contentProviderPath}/`
          }
        ]
      },
      schemaChangePolicy: {
        deleteBehavior: 'DELETE_FROM_DATABASE', //'LOG',
        updateBehavior: 'UPDATE_IN_DATABASE' //'LOG'
      },
      recrawlPolicy: {
        recrawlBehavior: 'CRAWL_EVERYTHING' //'CRAWL_NEW_FOLDERS_ONLY'
      },
      configuration: JSON.stringify({
        Version: 1,
        CrawlerOutput: {
          Partitions: {
            AddOrUpdateBehavior: 'InheritFromTable'
          }
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
  public callGlueService(id: string, action: string, iamAction: string): CallAwsService {
    return new CallAwsService(this, id, {
      service: 'glue',
      action: action,
      parameters: { Name: this.crawler.name },
      iamResources: [
        `arn:aws:glue:${this.region}:${this.accountId}:crawler/${this.crawler.name}`
      ],
      iamAction: iamAction
    });
  }
}

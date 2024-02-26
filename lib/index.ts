import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ContentProvider } from './constructs/content-provider';
import { ContentProviderPath } from './constants';
import { Database } from './constructs/database';
import { S3 } from './constructs/s3';

/**
 * The stack for the data quality monitoring application.
 *
 * This stack sets up the necessary AWS resources for the application:
 * - S3 Buckets for input and output
 * - Glue Database for Athena queries
 * - Step Function for beta content provider
 */
export class DataQualityMonitoringAppStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const stage = props.tags?.stage || '';
    const stackPrefix = id.toLowerCase();

    // Create the s3 buckets
    const s3Construct = new S3(this, 'S3', {
      stackPrefix: stackPrefix
    });

    // Create the database
    const databaseConstruct = new Database(this, 'Database', {
      accountId:  this.account,
      stackPrefix: stackPrefix
    });

    // Create a step function for beta content provider
    new ContentProvider(this, 'BetaContentProvider', {
      accountId: this.account,
      region: this.region,
      stage: stage,
      s3Construct: s3Construct,
      databaseConstruct: databaseConstruct,
      contentProviderPath: ContentProviderPath.BETA
    });

    // Add additional content provider step functions below
  }
}

import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Database } from './constructs/database';
import { S3 } from './constructs/s3';

/**
 * The stack for the data quality monitoring application.
 *
 * This stack sets up the necessary resources for the application:
 * - S3 Buckets for input and output
 * - Glue Database for Athena queries
 */
export class DataQualityMonitoringApp extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const inputBucketName = `${id}-input-s3-bucket`.toLowerCase();
    const outputBucketName = `${id}-output-s3-bucket`.toLowerCase();

    // Create the s3 buckets
    new S3(this, 'S3', {
      inputBucketName: inputBucketName,
      outputBucketName: outputBucketName
    });

    // Create the database
    new Database(this, 'Database', {
      accountId:  this.account,
      databaseName: 'glue_database'
    });
  }
}

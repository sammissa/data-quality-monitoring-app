import { Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';

/**
 * Properties for S3 construct.
 * @param inputBucketName - Name of the input s3 bucket containing content provider data files.
 * @param outputBucketName - Name of the output s3 bucket where content provider data quality results will be stored.
 */
export interface S3Props {
  readonly inputBucketName: string;
  readonly outputBucketName: string;
}

/**
 * Creates an input and output s3 bucket with lifecycle rules and encryption.
 * @property inputBucket - Input s3 bucket containing content provider data files.
 * @property outputBucket - Output s3 bucket where content provider data quality results will be stored.
 */
export class S3 extends Construct {
  public readonly inputBucket: Bucket;
  public readonly outputBucket: Bucket;

  constructor(scope: Construct, id: string, props: S3Props) {
    super(scope, id);

    // Create the input s3 bucket and enable EventBridge notification
    this.inputBucket = this.createBucket(props.inputBucketName, 'InputBucket');
    this.inputBucket.enableEventBridgeNotification();

    // Create the output s3 bucket
    this.outputBucket = this.createBucket(props.outputBucketName, 'OutputBucket');
  }

  /**
     * Creates an s3 bucket with lifecycle rules and encryption.
     * @param bucketName - Name of the s3 bucket
     * @param id - ID of the s3 bucket
     */
  private createBucket(bucketName: string, id: string): Bucket {
    return new Bucket(this, id, {
      bucketName: bucketName,
      versioned: true,
      encryption: BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        {
          enabled: true,
          expiration: Duration.days(90),
          noncurrentVersionExpiration: Duration.days(30),
          noncurrentVersionsToRetain: 2
        }
      ]
    });
  }
}
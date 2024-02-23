import { Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { BucketNameSuffix } from '../constants';
import { Construct } from 'constructs';

/**
 * Properties for S3 construct.
 *
 * @param {string} stackPrefix - Stack prefix added to created s3 buckets
 */
export interface S3Props {
  readonly stackPrefix: string;
}

/**
 * Construct creates an input and output AWS s3 bucket with lifecycle rules and encryption.
 *
 * @param {Construct} scope - Scope in which this construct is defined
 * @param {string} id - ID of the construct
 * @param {S3Props} props - Properties of the construct
 */
export class S3 extends Construct {
  public readonly inputBucket: Bucket;
  public readonly outputBucket: Bucket;

  constructor(scope: Construct, id: string, props: S3Props) {
    super(scope, id);

    this.inputBucket = this.createBucket(props.stackPrefix + BucketNameSuffix.INPUT, 'InputBucket');
    this.inputBucket.enableEventBridgeNotification();

    this.outputBucket = this.createBucket(props.stackPrefix + BucketNameSuffix.OUTPUT, 'OutputBucket');
  }

  /**
     * Creates a s3 bucket with lifecycle rules and encryption.
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
      ],
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });
  }
}
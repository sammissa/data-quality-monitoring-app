import { App, Stack } from 'aws-cdk-lib';
import { S3 } from '../../lib/constructs/s3';
import { Template } from 'aws-cdk-lib/assertions';

/**
 * Unit tests for the {@link S3} class.
 */
describe('S3', () => {
  let template: Template;

  const defaultS3BucketProps = {
    VersioningConfiguration: { Status: 'Enabled' },
    BucketEncryption: {
      ServerSideEncryptionConfiguration: [
        {
          ServerSideEncryptionByDefault: {
            SSEAlgorithm: 'AES256'
          }
        }
      ]
    },
    LifecycleConfiguration: {
      Rules: [
        {
          Status: 'Enabled',
          ExpirationInDays: 90,
          NoncurrentVersionExpiration: {
            NoncurrentDays: 30,
            NewerNoncurrentVersions: 2
          }
        }
      ]
    },
    Tags: [
      {
        Key: 'aws-cdk:auto-delete-objects',
        Value: 'true'
      }
    ]
  };

  beforeAll(() => {
    // Arrange
    const app = new App();
    const stack = new Stack(app, 'TestStack');
    const s3BucketConstructProps = {
      stackPrefix: 'test-stack'
    };

    // Act
    new S3(stack, 'TestS3', s3BucketConstructProps);
    template = Template.fromStack(stack);
  });

  test('creates the right number of resources', () => {
    // Assert
    template.resourceCountIs('AWS::S3::Bucket', 2);
    template.resourceCountIs('Custom::S3BucketNotifications', 1);
  });

  test('creates an input S3 bucket with the correct properties', () => {
    const expectedInputBucketProps = {
      BucketName: 'test-stack-s3-input-bucket',
      ...defaultS3BucketProps
    };

    // Assert
    template.hasResourceProperties('AWS::S3::Bucket', expectedInputBucketProps);
  });

  test('creates an output S3 bucket with the correct properties', () => {
    const expectedOutputBucketProps = {
      BucketName: 'test-stack-s3-output-bucket',
      ...defaultS3BucketProps
    };

    // Assert
    template.hasResourceProperties('AWS::S3::Bucket', expectedOutputBucketProps);
  });
});
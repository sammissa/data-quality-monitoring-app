import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { S3BucketConstruct } from '../../lib/s3/s3-bucket-construct';

/**
 * Unit tests for the {@link S3BucketConstruct} class.
 */
describe('S3BucketConstruct', () => {
    let stack: Stack;
    let s3BucketConstruct: S3BucketConstruct;
    let template: Template;
    let commonProperties: any;

    beforeEach(() => {
        // Arrange
        const app = new App();
        stack = new Stack(app, 'TestStack');
        const s3BucketConstructProps = {
            inputBucketName: 'test-input-bucket',
            outputBucketName: 'test-output-bucket',
        };

        // Act
        s3BucketConstruct = new S3BucketConstruct(stack, 'TestS3BucketConstruct', s3BucketConstructProps);
        template = Template.fromStack(stack);

        // Common properties
        commonProperties = {
            VersioningConfiguration: { Status: 'Enabled' },
            BucketEncryption: {
                ServerSideEncryptionConfiguration: [
                    {
                        ServerSideEncryptionByDefault: {
                            SSEAlgorithm: 'AES256',
                        },
                    },
                ],
            },
            LifecycleConfiguration: {
                Rules: [
                    {
                        Status: 'Enabled',
                        ExpirationInDays: 90,
                        NoncurrentVersionExpiration: {
                            NoncurrentDays: 30,
                            NewerNoncurrentVersions: 2,
                        },
                    },
                ],
            },
        };
    });

    test('creates the right number of resources', () => {
        // Assert
        template.resourceCountIs('AWS::S3::Bucket', 2);
        template.resourceCountIs('Custom::S3BucketNotifications', 1);
    });

    test('creates an input S3 bucket with the correct properties', () => {
        const expectedInputBucketProps = {
            BucketName: 'test-input-bucket',
            ...commonProperties,
        };

        // Assert
        template.hasResourceProperties('AWS::S3::Bucket', expectedInputBucketProps);
    });

    test('creates an output S3 bucket with the correct properties', () => {
        const expectedOutputBucketProps = {
            BucketName: 'test-output-bucket',
            ...commonProperties,
        };

        // Assert
        template.hasResourceProperties('AWS::S3::Bucket', expectedOutputBucketProps);
    });
});
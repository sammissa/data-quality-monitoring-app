import { App } from 'aws-cdk-lib';
import { DataQualityMonitoringAppStack } from '../lib';
import { Template } from 'aws-cdk-lib/assertions';

/**
 * Unit tests for the {@link DataQualityMonitoringAppStack} class.
 */
describe('DataQualityMonitoringAppStack', () => {
  test('creates the right number of resources', () => {
    // Arrange
    const app = new App();

    // Act
    const dataQualityMonitoringApp = new DataQualityMonitoringAppStack(app, 'TestDataQualityMonitoringAppStack', {});
    const template = Template.fromStack(dataQualityMonitoringApp);

    // Assert
    template.resourceCountIs('AWS::S3::Bucket', 2);
    template.resourceCountIs('Custom::S3BucketNotifications', 1);
    template.resourceCountIs('AWS::Glue::Database', 1);
  });
});
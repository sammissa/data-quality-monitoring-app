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
    template.resourceCountIs('AWS::IAM::Role', 6);
    template.resourceCountIs('AWS::IAM::Policy', 4);
    template.resourceCountIs('AWS::Glue::Classifier', 1);
    template.resourceCountIs('AWS::Glue::Crawler', 1);
    template.resourceCountIs('AWS::Athena::WorkGroup', 1);
    template.resourceCountIs('AWS::Logs::LogGroup', 1);
    template.resourceCountIs('AWS::Lambda::Function', 3);
    template.resourceCountIs('AWS::SNS::Topic', 2);
    template.resourceCountIs('AWS::StepFunctions::StateMachine', 1);
    template.resourceCountIs('AWS::Events::Rule', 1);
  });
});
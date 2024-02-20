import { App, Stack } from 'aws-cdk-lib';
import { Database } from '../../lib/constructs/database';
import { Template } from 'aws-cdk-lib/assertions';

/**
 * Unit tests for the {@link Database} class.
 */
describe('Database', () => {
  let template: Template;

  beforeEach(() => {
    // Arrange
    const app = new App();
    const stack = new Stack(app, 'TestStack');
    const databaseProps = {
      accountId: stack.account,
      stackPrefix: 'test_stack',
    };

    // Act
    new Database(stack, 'TestDatabase', databaseProps);
    template = Template.fromStack(stack);
  });

  test('creates the right number of resources', () => {
    // Assert
    template.resourceCountIs('AWS::Glue::Database', 1);
  });

  test('creates a glue database with the correct properties', () => {
    const expectedDatabaseProps = {
      CatalogId: {
        Ref: 'AWS::AccountId'
      },
      DatabaseInput: {
        Name: 'test_stack_glue_database',
        Description: 'Glue Database for executing Athena queries',
        CreateTableDefaultPermissions: [
          {
            Principal: {
              DataLakePrincipalIdentifier: 'IAM_ALLOWED_PRINCIPALS'
            },
            Permissions: [ 'ALL' ]
          }
        ]
      }
    };

    // Assert
    template.hasResourceProperties('AWS::Glue::Database', expectedDatabaseProps);
  });
});
#!/usr/bin/env node
import 'source-map-support/register';
import { StackName, Stage } from '../lib/constants';
import { App } from 'aws-cdk-lib';
import { DataQualityMonitoringAppStack } from '../lib';

const app = new App();
new DataQualityMonitoringAppStack(app, StackName.PROD, {
  tags: {
    stage: Stage.PROD
  }
});
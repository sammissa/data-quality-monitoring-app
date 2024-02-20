#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { DataQualityMonitoringAppStack } from '../lib';

const app = new App();
new DataQualityMonitoringAppStack(app, 'DQMADevStack', {
  tags: {
    stage: 'dev'
  }
});
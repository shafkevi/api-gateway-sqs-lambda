import { Stack, StackProps, Duration, Aws } from 'aws-cdk-lib';
import { aws_sqs as sqs } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_apigateway as apigateway } from 'aws-cdk-lib';
import { aws_lambda as lambda } from 'aws-cdk-lib';
import { aws_lambda_event_sources as lambda_event_sources } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class ApiGatewaySqsLambdaStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const queue = new sqs.Queue(this, 'ApiGatewaySqsLambdaQueue', {
      visibilityTimeout: Duration.seconds(300)
    });

    const restApiRole = new iam.Role(this, "RestApiRole", {
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSQSFullAccess")]
    });

    const baseApi = new apigateway.RestApi(this, "ApiGateway", {
      restApiName: "SqsApi"
    });

    baseApi.root.addMethod("ANY")

    const apiResource = baseApi.root.addResource('example')
    const integrationResponse: apigateway.IntegrationResponse = {
      statusCode:"200",
      responseTemplates:{"application/json": ""},
    }

    const apiResourceSqsIntegration = new apigateway.AwsIntegration({
      service: 'sqs',
      path: `${Aws.ACCOUNT_ID}/${queue.queueName}`,
      options: {
        credentialsRole: restApiRole,
        integrationResponses: [integrationResponse],
        requestTemplates: {"application/json": "Action=SendMessage&MessageBody=$input.body"},
        passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
        requestParameters:{"integration.request.header.Content-Type": "'application/x-www-form-urlencoded'"},
      }
    })

    const methodResponse: apigateway.MethodResponse = {
      statusCode: '200'
    }

    apiResource.addMethod(
      "POST",
      apiResourceSqsIntegration,
      {methodResponses: [methodResponse]}
    )

    const sqsLambda = new lambda.Function(this, "SqsTriggerLambda", {
      handler: "lambda-handler.handler",
      runtime: lambda.Runtime.PYTHON_3_9,
      code:lambda.Code.fromAsset('lambda'),
    })

    const sqsEventSource = new lambda_event_sources.SqsEventSource(queue);

    sqsLambda.addEventSource(sqsEventSource);


  }
}

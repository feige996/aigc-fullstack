import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { rabbitExchanges, rabbitQueues, rabbitRoutingKeys } from '@aigc/shared-contracts'
import * as amqp from 'amqplib'

interface PublishJsonInput {
  exchange: string
  routingKey: string
  message: unknown
}

@Injectable()
export class RabbitmqService implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqService.name)
  private connection?: amqp.ChannelModel
  private channel?: amqp.Channel

  constructor(private readonly configService: ConfigService) {}

  async publishGenerationRequest(message: unknown) {
    await this.publishJson({
      exchange: rabbitExchanges.generationRequest,
      routingKey: rabbitRoutingKeys.imageGenerate,
      message
    })
  }

  async publishJson({ exchange, routingKey, message }: PublishJsonInput) {
    const channel = await this.getChannel()
    const payload = Buffer.from(JSON.stringify(message))

    const published = channel.publish(exchange, routingKey, payload, {
      contentType: 'application/json',
      deliveryMode: 2
    })

    if (!published) {
      throw new Error(`RabbitMQ publish buffer is full for ${exchange}:${routingKey}`)
    }
  }

  async consumeGenerationResults(handler: (message: unknown) => Promise<void>) {
    const channel = await this.getChannel()

    await this.assertGenerationResultTopology(channel)

    await channel.consume(
      rabbitQueues.generationResultPersist,
      async (message) => {
        if (!message) {
          return
        }

        try {
          const payload = JSON.parse(message.content.toString('utf-8')) as unknown
          await handler(payload)
          channel.ack(message)
        } catch (error) {
          this.logger.error('Failed to handle generation result message', error)
          channel.nack(message, false, false)
        }
      },
      {
        noAck: false
      }
    )
  }

  async onModuleDestroy() {
    await this.channel?.close()
    await this.connection?.close()
  }

  private async getChannel() {
    if (this.channel) {
      return this.channel
    }

    const url = this.configService.get<string>('RABBITMQ_URL')

    if (!url) {
      throw new Error('RABBITMQ_URL is not configured')
    }

    this.connection = await amqp.connect(url)
    this.channel = await this.connection.createChannel()

    await this.channel.assertExchange(rabbitExchanges.generationRequest, 'direct', {
      durable: true
    })

    await this.channel.assertQueue(rabbitQueues.imageGenerate, {
      durable: true
    })

    await this.channel.bindQueue(
      rabbitQueues.imageGenerate,
      rabbitExchanges.generationRequest,
      rabbitRoutingKeys.imageGenerate
    )

    await this.assertGenerationResultTopology(this.channel)

    return this.channel
  }

  private async assertGenerationResultTopology(channel: amqp.Channel) {
    await channel.assertExchange(rabbitExchanges.generationResult, 'direct', {
      durable: true
    })

    await channel.assertQueue(rabbitQueues.generationResultPersist, {
      durable: true
    })

    await channel.bindQueue(
      rabbitQueues.generationResultPersist,
      rabbitExchanges.generationResult,
      rabbitRoutingKeys.taskSucceeded
    )

    await channel.bindQueue(
      rabbitQueues.generationResultPersist,
      rabbitExchanges.generationResult,
      rabbitRoutingKeys.taskFailed
    )
  }
}

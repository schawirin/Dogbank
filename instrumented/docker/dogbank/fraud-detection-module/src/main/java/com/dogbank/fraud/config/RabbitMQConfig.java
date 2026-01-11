package com.dogbank.fraud.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * RabbitMQ Configuration for Fraud Detection Service
 * 
 * Includes COAF (Conselho de Controle de Atividades Financeiras) notification queue
 * for Brazilian regulatory compliance - transactions >= R$ 50,000.00
 */
@Configuration
public class RabbitMQConfig {

    // PIX Processing queues
    public static final String QUEUE_FRAUD = "pix.fraud";
    public static final String EXCHANGE_PROCESSING = "pix.processing";
    public static final String EXCHANGE_DLX = "pix.dlx";
    public static final String QUEUE_DLQ = "pix.dlq";

    // COAF (Brazilian Financial Intelligence Unit) notification queue
    public static final String EXCHANGE_COAF = "coaf.exchange";
    public static final String QUEUE_COAF = "coaf.notifications";
    public static final String ROUTING_KEY_COAF = "coaf.notification";

    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(jsonMessageConverter());
        return template;
    }

    @Bean
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
            ConnectionFactory connectionFactory) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(jsonMessageConverter());
        factory.setConcurrentConsumers(2);
        factory.setMaxConcurrentConsumers(5);
        factory.setPrefetchCount(10);
        factory.setDefaultRequeueRejected(false); // Send to DLQ on failure
        return factory;
    }

    // ================================================================
    // COAF Exchange and Queue Configuration
    // Brazilian regulation requires reporting suspicious transactions
    // >= R$ 50,000.00 to COAF (Conselho de Controle de Atividades Financeiras)
    // ================================================================

    @Bean
    public DirectExchange coafExchange() {
        return new DirectExchange(EXCHANGE_COAF, true, false);
    }

    @Bean
    public Queue coafQueue() {
        return QueueBuilder.durable(QUEUE_COAF)
            .withArgument("x-message-ttl", 604800000) // 7 days TTL
            .withArgument("x-max-length", 10000) // Max 10k messages
            .build();
    }

    @Bean
    public Binding coafBinding() {
        return BindingBuilder.bind(coafQueue())
            .to(coafExchange())
            .with(ROUTING_KEY_COAF);
    }
}

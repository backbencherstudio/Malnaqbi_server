import { Controller, Post, Req, Headers, UseGuards, Body, HttpException, HttpStatus } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { Request } from 'express';
import { TransactionRepository } from '../../../common/repository/transaction/transaction.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { CreateOrderDto } from './dto/create-order-dto';
import { StripePayment } from 'src/common/lib/Payment/stripe/StripePayment';

@Controller('payment')
export class StripeController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('pay')
  @UseGuards(JwtAuthGuard)
  async pay(@Body() createOrderDto: CreateOrderDto, @Req() req: Request) {
    try {
      const userId = req.user?.userId ;
      console.log(createOrderDto);

      if (!userId) throw new Error('User ID is missing');

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true , billing_id: true },
      });

     if (!user) {
        return {          
          success: false,
          message: 'User not found',
        };
      }

      const cartItems = await this.prisma.cartItem.findMany({
        where: { user_id: userId },
        include: {
          product: true, 
        },
      });

      if (!cartItems.length) throw new Error('No items in the cart');

      const orderItemsWithDetails = cartItems.map(item => {
        return {
          product_id: item.product_id,
          quantity: item.quantity,
          product_name: item.product.title,
          product_price: item.product.price,
          total_price: item.product.price * item.quantity,
        };
      });

      const totalAmount = orderItemsWithDetails.reduce(
        (sum, item) => sum + item.total_price,
        0
      );

      if (totalAmount <= 0) throw new Error('Amount must be a positive number');

      const currency = 'usd';
      const customer_id = user.billing_id || null;

      const payment = await StripePayment.createPaymentIntent({
        order_items: orderItemsWithDetails,
        metadata: {
          user_id: userId,
          order_details: JSON.stringify(orderItemsWithDetails),
        },
        amount: totalAmount,
        currency,
        customer_id,
      });

      console.log('PaymentIntent Created:', payment.client_secret);
      console.log('Metadata:', payment.metadata);

      const order = await this.prisma.order.create({
        data: {
          user_id: userId,
          status: 'pending',
          payment_method: 'wallet',
          payment_status: 'pending',
          total_price: totalAmount,
          cart_items: {
            connect: cartItems.map(item => ({ id: item.id })),
          },
        },
      });

      return {
        clientSecret: payment.client_secret,
        msg: 'PaymentIntent created successfully',
        totalAmount,
        orderId: order.id,
        order,
      };
    } catch (error) {
      console.error('Error creating PaymentIntent:', error);
      throw new HttpException(
        {
          statusCode: 500,
          message: 'Error creating payment',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

@Post('webhook')
async handleWebhook(
  @Headers('stripe-signature') signature: string,
  @Req() req: Request,
) {
  try {
    const payload = req.rawBody.toString();

    const event = await this.stripeService.handleWebhook(payload, signature);

    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntentSucceeded = event.data.object;
      //  console.log('PaymentIntent metadata:', paymentIntentSucceeded.metadata);

        const order = await this.prisma.order.create({
          data: {
            user_id: paymentIntentSucceeded.metadata.user_id,  
            status: 'completed', 
            payment_method: typeof paymentIntentSucceeded.payment_method === 'string'
              ? paymentIntentSucceeded.payment_method
              : paymentIntentSucceeded.payment_method?.id ?? '',  
            payment_status: 'succeeded', 
            total_price: paymentIntentSucceeded.amount_received / 100,
            cart_items: {
              connect: [
                { id: paymentIntentSucceeded.metadata.cart_item_id },
              ],
            },
          },
        });

        console.log('Order created:', order);

        await TransactionRepository.updateTransaction({
          reference_number: paymentIntentSucceeded.id,
          status: 'succeeded',
          paid_amount: paymentIntentSucceeded.amount_received / 100,
          paid_currency: paymentIntentSucceeded.currency,
          raw_status: paymentIntentSucceeded.status,
        });
        break;

      case 'payment_intent.payment_failed':
        const paymentIntentFailed = event.data.object;
        console.log('PaymentIntent Failed:', paymentIntentFailed);

        await TransactionRepository.updateTransaction({
          reference_number: paymentIntentFailed.id,
          status: 'failed',
          raw_status: paymentIntentFailed.status,
        });
        break;

      case 'payment_intent.canceled':
        const paymentIntentCanceled = event.data.object;
        console.log('PaymentIntent Canceled:', paymentIntentCanceled);

        await TransactionRepository.updateTransaction({
          reference_number: paymentIntentCanceled.id,
          status: 'canceled',
          raw_status: paymentIntentCanceled.status,
        });
        break;

      case 'payment_intent.requires_action':
        const paymentIntentRequiresAction = event.data.object;
        console.log('PaymentIntent Requires Action:', paymentIntentRequiresAction);

        await TransactionRepository.updateTransaction({
          reference_number: paymentIntentRequiresAction.id,
          status: 'requires_action',
          raw_status: paymentIntentRequiresAction.status,
        });
        break;

      case 'charge.succeeded':
        const chargeSucceeded = event.data.object;

        const chargeOrder = await this.prisma.order.create({
          data: {
            user_id: chargeSucceeded.metadata.user_id,  
            status: 'completed', 
            payment_method: chargeSucceeded.payment_method,
            payment_status: 'succeeded', 
            total_price: chargeSucceeded.amount / 100,
            cart_items: {
              connect: [
                { id: chargeSucceeded.metadata.cart_item_id },
              ],
            },
          },
        });

        console.log('Order created from charge:', chargeOrder);

        await TransactionRepository.updateTransaction({
          reference_number: chargeSucceeded.id,
          status: 'succeeded',
          paid_amount: chargeSucceeded.amount / 100,
          paid_currency: chargeSucceeded.currency,
          raw_status: chargeSucceeded.status,
        });
        break;

      case 'payment_intent.created':
        const paymentIntentCreated = event.data.object;
       // console.log('PaymentIntent Created:', paymentIntentCreated);

        break;

      case 'charge.updated':
        const chargeUpdated = event.data.object;
        console.log('Charge Updated');

        break;

      case 'payout.paid':
        const payoutPaid = event.data.object;
        console.log('Payout Paid:', payoutPaid);
        break;

      case 'payout.failed':
        const payoutFailed = event.data.object;
        console.log('Payout Failed:', payoutFailed);
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return { received: true };
  } catch (error) {
    console.error('Webhook error:', error);
    return { received: false };
  }
}


}

import { Injectable } from '@nestjs/common';
const twilio = require('twilio'); // Change to require syntax

@Injectable()
export class SmsService {
  private client;

  constructor() {
    this.client = new twilio( // Add 'new' keyword here
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
  }

  async sendOtpToPhone(phone_number: string, otp: string) {
    try {
      await this.client.messages.create({
        body: `Your OTP code is: ${otp}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone_number,
      });
      return true;
    } catch (error) {
      console.error('Error sending OTP via Twilio:', error);
      return false;
    }
  }
}

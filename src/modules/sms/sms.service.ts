import * as Twilio from 'twilio';

export class SmsService {
  private client;

  constructor() {
    this.client = Twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
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

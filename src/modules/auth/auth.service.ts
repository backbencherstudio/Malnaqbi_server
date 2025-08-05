// external imports
import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

//internal imports
import appConfig from '../../config/app.config';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRepository } from '../../common/repository/user/user.repository';
import { MailService } from '../../mail/mail.service';
import { UcodeRepository } from '../../common/repository/ucode/ucode.repository';
import { UpdateUserDto } from './dto/update-user.dto';
import { SojebStorage } from '../../common/lib/Disk/SojebStorage';
import { DateHelper } from '../../common/helper/date.helper';
import { StripePayment } from '../../common/lib/Payment/stripe/StripePayment';
import { StringHelper } from '../../common/helper/string.helper';
import { SmsService } from '../sms/sms.service';
import { CreateBusinessOwnerDto } from './dto/create-business-owner.dto';
import * as bcrypt from 'bcrypt';
import { CreateExperienceDto } from './dto/create-expreience-dto';
import { AddToCartDto } from './dto/creat-cart-dto';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private mailService: MailService,
    @InjectRedis() private readonly redis: Redis,
  ) { }


  //get me 
  async me(userId: string) {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          address: true,
          phone_number: true,
          type: true,
          gender: true,
          date_of_birth: true,
          created_at: true,
        },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      if (user.avatar) {
        user['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + user.avatar,
        );
      }

      if (user) {
        return {
          success: true,
          data: user,
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  //register step one
  async registerStepOne({
    phone_number
  }: {
    phone_number: string;
  }) {
    try {
      // Checking if phone number already exists
      const userPhoneExist = await UserRepository.exist({
        field: 'phone_number',
        value: String(phone_number),
      });

      if (userPhoneExist) {
        return {
          success: false,
          statusCode: 401,
          message: 'Phone number already exists.',
        };
      }

      // otp is generating here
      const token = await UcodeRepository.createOtpForPhone(phone_number);

      if (!token) {
        return {
          success: false,
          statusCode: 500,
          message: 'Unable to generate OTP. Please try again.',
        };
      }

      const smsService = new SmsService();
      const sent = await smsService.sendOtpToPhone(phone_number, token);

      if (!sent) {
        return {
          success: false,
          message: 'Failed to send OTP SMS. Please try again.',
        };
      }

      return {
        success: true,
        message: 'We have sent an OTP code to your phone number via SMS.',
      };

    } catch (error) {
      console.error('Error in registerStepOne:', error);
      return {
        success: false,
        message: 'Internal server error. Please try again later.',
      };
    }
  }
  //register step two
  async matchPhoneOtp({
    phone_number,
    token,
  }: {
    phone_number: string;
    token: string;
  }) {
    try {
      const otpRecord = await this.prisma.ucode.findFirst({
        where: {
          phone_number,
          token,
          status: 1,
        },
      });

      if (!otpRecord) {
        return {
          success: false,
          message: 'Invalid OTP code.',
        };
      }

      if (otpRecord.expired_at && new Date() > otpRecord.expired_at) {
        return {
          success: false,
          message: 'OTP expired. Please request a new one.',
          shouldResendOtp: true,
        };
      }

      await this.prisma.ucode.deleteMany({
        where: { phone_number },
      });

      let user = await this.prisma.user.findUnique({
        where: { phone_number },
      });

      if (user) {
        await this.prisma.user.update({
          where: { phone_number },
          data: { phone_number_verified: true },
        });
      }

      if (!user) {
        user = await this.prisma.user.create({
          data: { phone_number },
        });
      }

      const jwtToken = this.jwtService.sign({
        userId: user.id,
        id: user.id,
        email: user.email,
        phone_number: user.phone_number,
      });


      return {
        success: true,
        message: "Phone number verified successfully.",
        token: jwtToken,
      };
    } catch (error) {
      console.error('Error in matchPhoneOtp:', error);
      return {
        success: false,
        message: 'Internal server error. Please try again later.',
      };
    }
  }
  // Finalize registration after phone verification
  async finalizeRegistration({
    userId,
    name,
    address,
    avatar,
    password,
  }: {
    userId: string;
    name: string;
    address: string;
    avatar?: Express.Multer.File;
    password: string;
  }) {
    // Validate inputs
    if (!userId || !name || !address) {
      throw new BadRequestException('Missing required fields');
    }

    const hashedPassword = await bcrypt.hash(password, appConfig().security.salt);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.name && user.address) {
      throw new ConflictException('Account already registered');
    }

    // Handle avatar upload
    let avatarFileName: string | undefined;
    if (avatar) {
      try {
        if (user.avatar) {
          await this.deleteOldAvatar(user.avatar);
        }
        avatarFileName = await this.uploadAvatar(avatar);
      } catch (error) {
        console.error('Avatar upload failed:', error);
        throw new InternalServerErrorException('Avatar upload failed');
      }
    }

    // Update user
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          name,
          address,
          password: hashedPassword,
          ...(avatarFileName && { avatar: avatarFileName }),
        },
      });

      //create stripe customer
     const stripeCustomer =  await StripePayment.createCustomer({
        user_id: userId,
        email: user.email,
        name: user.name,
      });
      console.log('Stripe customer created successfully', stripeCustomer);
      if(stripeCustomer){
         await this.prisma.user.update({
            where: {
              id: user.id,
            },
            data: {
              billing_id: stripeCustomer.id,
            },
          });
      }

      return {
        success: true,
        message: 'Registration completed successfully',
      };
    } catch (error) {
      console.error('Registration update failed:', error);
      throw new InternalServerErrorException('Registration update failed');
    }
  }
  //-----------------registration end for normal user-----------------



  // ---------------------registration for Business owner-------------------

  async registerBusinessOwner(createBusinessOwnerDto: CreateBusinessOwnerDto) {
    const { phone_number, name, address, password } = createBusinessOwnerDto;

    // Check if phone number exists
    const existingPhone = await UserRepository.exist({
      field: 'phone_number',
      value: phone_number,
    });
    if (existingPhone) throw new ConflictException('Phone number already exists');

    const hashedPassword = await bcrypt.hash(password, appConfig().security.salt);

    try {
      const user = await this.prisma.user.create({
        data: {
          phone_number,
          name,
          address,
          type: 'BUSINESS_OWNER',
          password: hashedPassword,
          is_verified: false,
        },
      });

      // Generate OTP & send it
      const otp = await UcodeRepository.createOtpForPhone(phone_number);

      return {
        success: true,
        message: 'OTP sent to phone. Verify to complete registration.',
        phone_number: user.phone_number,
      };
    } catch (err) {
      if (err.code === 'P2002') throw new ConflictException('Phone number already exists');
      throw new InternalServerErrorException('Registration failed');
    }
  }
  //---------------------registration for Business owner end-------------------








  //-----------------------imgage upload-----------------------
  private async deleteOldAvatar(filename: string): Promise<void> {
    await SojebStorage.delete(appConfig().storageUrl.avatar + filename);
  }
  private async uploadAvatar(file: Express.Multer.File): Promise<string> {
    const fileName = `${StringHelper.randomString()}-${file.originalname}`;
    await SojebStorage.put(
      appConfig().storageUrl.avatar + fileName,
      file.buffer,
    );
    return fileName;
  }
  //-----------------------imgage upload end-----------------------



  //-----------------------update user-----------------------
  async updateUser(
    userId: string,
    updateUserDto: UpdateUserDto,
    image?: Express.Multer.File,
  ) {
    try {
      const data: any = {};
      if (updateUserDto.name) {
        data.name = updateUserDto.name;
      }
      if (updateUserDto.first_name) {
        data.first_name = updateUserDto.first_name;
      }
      if (updateUserDto.last_name) {
        data.last_name = updateUserDto.last_name;
      }
      if (updateUserDto.phone_number) {
        data.phone_number = updateUserDto.phone_number;
      }
      if (updateUserDto.country) {
        data.country = updateUserDto.country;
      }
      if (updateUserDto.state) {
        data.state = updateUserDto.state;
      }
      if (updateUserDto.local_government) {
        data.local_government = updateUserDto.local_government;
      }
      if (updateUserDto.city) {
        data.city = updateUserDto.city;
      }
      if (updateUserDto.zip_code) {
        data.zip_code = updateUserDto.zip_code;
      }
      if (updateUserDto.address) {
        data.address = updateUserDto.address;
      }
      if (updateUserDto.gender) {
        data.gender = updateUserDto.gender;
      }
      if (updateUserDto.date_of_birth) {
        data.date_of_birth = DateHelper.format(updateUserDto.date_of_birth);
      }
      if (image) {
        // delete old image from storage
        const oldImage = await this.prisma.user.findFirst({
          where: { id: userId },
          select: { avatar: true },
        });
        if (oldImage.avatar) {
          await SojebStorage.delete(
            appConfig().storageUrl.avatar + oldImage.avatar,
          );
        }

        // upload file
        const fileName = `${StringHelper.randomString()}${image.originalname}`;
        await SojebStorage.put(
          appConfig().storageUrl.avatar + fileName,
          image.buffer,
        );

        data.avatar = fileName;
      }
      const user = await UserRepository.getUserDetails(userId);
      if (user) {
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            ...data,
          },
        });

        return {
          success: true,
          message: 'User updated successfully',
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  async validateUser(
    phone_number: string,
    pass: string,
    token?: string,
  ): Promise<any> {
    const _password = pass;
    const user = await this.prisma.user.findFirst({
      where: {
        phone_number: phone_number,
      },
    });

    if (user) {
      const _isValidPassword = await UserRepository.validatePassword({
        phone_number: phone_number,
        password: _password,
      });
      if (_isValidPassword) {
        const { password, ...result } = user;
        if (user.is_two_factor_enabled) {
          if (token) {
            const isValid = await UserRepository.verify2FA(user.id, token);
            if (!isValid) {
              throw new UnauthorizedException('Invalid token');
              // return {
              //   success: false,
              //   message: 'Invalid token',
              // };
            }
          } else {
            throw new UnauthorizedException('Token is required');
            // return {
            //   success: false,
            //   message: 'Token is required',
            // };
          }
        }
        return result;
      } else {
        throw new UnauthorizedException('Password not matched');
        // return {
        //   success: false,
        //   message: 'Password not matched',
        // };
      }
    } else {
      throw new UnauthorizedException('phone_number not found');
      // return {
      //   success: false,
      //   message: 'Email not found',
      // };
    }
  }
  //-----------------------update user end-----------------------




  //-------------------------login-------------------------
  async login({ phone_number, userId }) {
    try {
      const payload = { phone_number: phone_number, sub: userId };

      const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
      const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

      const user = await UserRepository.getUserDetails(userId);

      // store refreshToken
      await this.redis.set(
        `refresh_token:${user.id}`,
        refreshToken,
        'EX',
        60 * 60 * 24 * 7, // 7 days in seconds
      );

      return {
        success: true,
        message: 'Logged in successfully',
        authorization: {
          type: 'bearer',
          access_token: accessToken,
          refresh_token: refreshToken,
        },
        type: user.type,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  async refreshToken(user_id: string, refreshToken: string) {
    try {
      const storedToken = await this.redis.get(`refresh_token:${user_id}`);

      if (!storedToken || storedToken != refreshToken) {
        return {
          success: false,
          message: 'Refresh token is required',
        };
      }

      if (!user_id) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const userDetails = await UserRepository.getUserDetails(user_id);
      if (!userDetails) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const payload = { email: userDetails.email, sub: userDetails.id };
      const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });

      return {
        success: true,
        authorization: {
          type: 'bearer',
          access_token: accessToken,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  async revokeRefreshToken(user_id: string) {
    try {
      const storedToken = await this.redis.get(`refresh_token:${user_id}`);
      if (!storedToken) {
        return {
          success: false,
          message: 'Refresh token not found',
        };
      }

      await this.redis.del(`refresh_token:${user_id}`);

      return {
        success: true,
        message: 'Refresh token revoked successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  //-------------------------login end-------------------------


  //-----------------------forget password-----------------------
  async forgotPassword(phone_number) {
    try {
      const user = await UserRepository.exist({
        field: 'phone_number',
        value: phone_number,
      });

      if (user) {
        const token = await UcodeRepository.createOtpForPhone(phone_number);
        return {
          success: true,
          message: 'We have sent an OTP code to your phone_number',
        };
      } else {
        return {
          success: false,
          message: 'phone_number not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  async resetPassword(body) {
    try {
      const { phone_number, token, password } = body;
      if (!phone_number || !token || !password) {
        throw new BadRequestException('phone_number, token and password are required');
      }

      const otpRecord = await this.prisma.ucode.findFirst({
        where: {
          phone_number,
          token,
          status: 1,
        },
      });

      if (!otpRecord) {
        return {
          success: false,
          message: 'Invalid OTP code',
        };
      }

      if (otpRecord.expired_at && new Date() > otpRecord.expired_at) {
        return {
          success: false,
          message: 'OTP expired. Please request a new one.',
          shouldResendOtp: true,
        };
      }

      // delete otp after match
      await this.prisma.ucode.deleteMany({
        where: { phone_number },
      });

      // update password
      const hashedPassword = await bcrypt.hash(password, appConfig().security.salt);
      await this.prisma.user.update({
        where: { phone_number },
        data: { password: hashedPassword },
      });

      return {
        success: true,
        message: 'Password reset successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  //-----------------------forget password end-----------------------



  async verifyEmail({ email, token }) {
    try {
      const user = await UserRepository.exist({
        field: 'email',
        value: email,
      });

      if (user) {
        const existToken = await UcodeRepository.validateToken({
          email: email,
          token: token,
        });

        if (existToken) {
          await this.prisma.user.update({
            where: {
              id: user.id,
            },
            data: {
              email_verified_at: new Date(Date.now()),
            },
          });

          // delete otp code
          // await UcodeRepository.deleteToken({
          //   email: email,
          //   token: token,
          // });

          return {
            success: true,
            message: 'Email verified successfully',
          };
        } else {
          return {
            success: false,
            message: 'Invalid token',
          };
        }
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  async resendVerificationEmail(email: string) {
    try {
      const user = await UserRepository.getUserByEmail(email);

      if (user) {
        // create otp code
        const token = await UcodeRepository.createToken({
          userId: user.id,
          isOtp: true,
        });

        // send otp code to email
        await this.mailService.sendOtpCodeToEmail({
          email: email,
          name: user.name,
          otp: token,
        });

        return {
          success: true,
          message: 'We have sent a verification code to your email',
        };
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  async changePassword({ user_id, oldPassword, newPassword }) {
    try {
      const user = await UserRepository.getUserDetails(user_id);

      if (user) {
        const _isValidPassword = await UserRepository.validatePassword({
          phone_number: user.email,
          password: oldPassword,
        });
        if (_isValidPassword) {
          await UserRepository.changePassword({
            email: user.email,
            password: newPassword,
          });

          return {
            success: true,
            message: 'Password updated successfully',
          };
        } else {
          return {
            success: false,
            message: 'Invalid password',
          };
        }
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  async requestEmailChange(user_id: string, email: string) {
    try {
      const user = await UserRepository.getUserDetails(user_id);
      if (user) {
        const token = await UcodeRepository.createToken({
          userId: user.id,
          isOtp: true,
          email: email,
        });

        await this.mailService.sendOtpCodeToEmail({
          email: email,
          name: email,
          otp: token,
        });

        return {
          success: true,
          message: 'We have sent an OTP code to your email',
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  async changeEmail({
    user_id,
    new_email,
    token,
  }: {
    user_id: string;
    new_email: string;
    token: string;
  }) {
    try {
      const user = await UserRepository.getUserDetails(user_id);

      if (user) {
        const existToken = await UcodeRepository.validateToken({
          email: new_email,
          token: token,
          forEmailChange: true,
        });

        if (existToken) {
          await UserRepository.changeEmail({
            user_id: user.id,
            new_email: new_email,
          });

          // delete otp code
          await UcodeRepository.deleteToken({
            email: new_email,
            token: token,
          });

          return {
            success: true,
            message: 'Email updated successfully',
          };
        } else {
          return {
            success: false,
            message: 'Invalid token',
          };
        }
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // --------- 2FA ---------
  async generate2FASecret(user_id: string) {
    try {
      return await UserRepository.generate2FASecret(user_id);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  async verify2FA(user_id: string, token: string) {
    try {
      const isValid = await UserRepository.verify2FA(user_id, token);
      if (!isValid) {
        return {
          success: false,
          message: 'Invalid token',
        };
      }
      return {
        success: true,
        message: '2FA verified successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  async enable2FA(user_id: string) {
    try {
      const user = await UserRepository.getUserDetails(user_id);
      if (user) {
        await UserRepository.enable2FA(user_id);
        return {
          success: true,
          message: '2FA enabled successfully',
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  async disable2FA(user_id: string) {
    try {
      const user = await UserRepository.getUserDetails(user_id);
      if (user) {
        await UserRepository.disable2FA(user_id);
        return {
          success: true,
          message: '2FA disabled successfully',
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  // --------- end 2FA ---------



//--------------------share experience--------------------
async shareExperience(userId: string, dto: CreateExperienceDto, imageFiles: string[]) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const experience = await this.prisma.experienceReview.create({
        data: {
          user_id: userId,
          place_id: dto.place_id,
          rating: dto.rating,
          tags: dto.tags || [],
          review_title: dto.review_title,
          review_body: dto.review_body,
          imgage: imageFiles, // ✅ storing file names
        },
      });

      // ✅ Return full URLs for images
      const experienceWithUrls = {
        ...experience,
        imgage: experience.imgage.map((fileName) =>
          SojebStorage.url(`${appConfig().storageUrl.experience}/${fileName}`),
        ),
      };

      return {
        success: true,
        message: 'Experience shared successfully',
        data: experienceWithUrls,
      };
    } catch (error) {
      console.error('Error sharing experience:', error);
      throw new InternalServerErrorException('Failed to share experience');
    }
  }

//--------------------share experience end--------------------

//--------------------make a favourite place--------------------
async toggleFavourite(userId: string, placeId: string) {
  const existing = await this.prisma.favouritePlace.findUnique({
    where: {
      user_id_place_id: {
        user_id: userId,
        place_id: placeId,
      },
    },
  });

  if (existing) {
    await this.prisma.favouritePlace.delete({
      where: { id: existing.id },
    });
    return { success: true, message: 'Removed from favourites' };
  }

  await this.prisma.favouritePlace.create({
    data: { user_id: userId, place_id: placeId },
  });

  return { success: true, message: 'Added to favourites' };
}
async getFavouritePlaces(userId: string) {
  const favourites = await this.prisma.favouritePlace.findMany({
    where: { user_id: userId },
    include: {
      place: {
        select: {
          id: true,
          title: true,
          location: true,
          image: true,
        },
      },
    },
  });

  if (!favourites || favourites.length === 0) {
    return { success: false, message: 'No favourite places found' };
  }

  const formattedFavourites = favourites.map(fav => ({
    ...fav.place,
    image_url: fav.place.image
      ? SojebStorage.url(`${appConfig().storageUrl.place}/${fav.place.image}`)
      : null,
  }));

  return { success: true, data: formattedFavourites };
}
//--------------------make a favourite place end--------------------




//--------------------get user cart items--------------------
async addOrUpdateCart(userId: string, dto: AddToCartDto) {
  const existing = await this.prisma.cartItem.findUnique({
    where: {
      user_id_product_id: {
        user_id: userId,
        product_id: dto.product_id,
      },
    },
  });

  if (existing) {
    let updatedQuantity = existing.quantity + (dto.quantity || 1);

    if (updatedQuantity <= 0) {
      await this.prisma.cartItem.delete({
        where: { id: existing.id },
      });
      return {
        success: true,
        message: 'Item removed from cart',
      };
    }

    return this.prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: updatedQuantity },
    });
  }

  return this.prisma.cartItem.create({
    data: {
      user_id: userId,
      product_id: dto.product_id,
      quantity: dto.quantity || 1,
    },
  });
}


async getCartItems(userId: string) {
  const cartItems = await this.prisma.cartItem.findMany({
    where: { user_id: userId },
    include: {
      product: {
        select: {
          id: true,
          title: true,
          price: true,
          in_stock: true,
          image: true,
        },
      },
    },
  });

  const total_price = cartItems.reduce((sum, item) => {
    return sum + (item.product.price * item.quantity);
  }, 0);

  const formatted = cartItems.map((item) => ({
    id: item.id,
    product_id: item.product.id,
    title: item.product.title,
    price: item.product.price,
    in_stock: item.product.in_stock,
    quantity: item.quantity,
    total_price: item.product.price * item.quantity,
    image_url: item.product.image
      ? SojebStorage.url(`${appConfig().storageUrl.place.replace(/\/$/, '')}/${item.product.image}`)
      : null,
  }));

  return {
    success: true,
    data: formatted,
    total_price: total_price, 
  };
}
//--------------------get user cart items end--------------------


}

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// A parameter decorator that extracts the authenticated user from the request
// Instead of writing (req) => req.user in every controller method,
// you just write @CurrentUser() user: UserDocument
//
// Usage in a controller:
//   @Get('me')
//   @UseGuards(JwtAuthGuard)
//   getMe(@CurrentUser() user: UserDocument) {
//     return user;
//   }
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user; // set by JwtStrategy.validate()
  },
);
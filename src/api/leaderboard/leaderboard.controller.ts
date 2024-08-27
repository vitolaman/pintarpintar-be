import { Controller, Get, HttpStatus, Req, Res } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

@ApiBearerAuth()
@Controller('leaderboard')
@ApiTags('Leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('/weekly-leaderboard')
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Success',
    schema: {
      example: {
        responseMessage: 'Get Top Weekly Leaderboard Success',
        data: {
          topUsers: [
            {
              rank: '1',
              userId: 'a1773542-5766-4750-a7cc-9dc6b341f903',
              username: 'invipirate',
              sumPoint: 22,
              updated_at: '2024-08-27T07:38:43.741Z',
            },
            {
              rank: '2',
              userId: 'acba0d2a-f9a4-4234-a1d5-3bb5e732284e',
              username: 'testingleaderboard21',
              sumPoint: 22,
              updated_at: '2024-08-27T13:41:51.864Z',
            },
            {
              rank: '3',
              userId: '28fafed9-017a-4fb4-9b76-78258238bf1e',
              username: 'testingleaderboard22',
              sumPoint: 22,
              updated_at: '2024-08-27T14:41:51.685Z',
            },
            {
              rank: '4',
              userId: '3523eae6-8508-482f-9512-d96502e968d7',
              username: 'testingleaderboard20',
              sumPoint: 20,
              updated_at: '2024-08-27T14:41:52.044Z',
            },
            {
              rank: '5',
              userId: '0e498fd0-a0af-4754-beb4-29d6f7d095ac',
              username: 'testingleaderboard19',
              sumPoint: 19,
              updated_at: '2024-08-27T14:41:52.223Z',
            },
            {
              rank: '6',
              userId: 'c1be1813-3626-411b-8b67-811ee99a10dd',
              username: 'testingleaderboard18',
              sumPoint: 18,
              updated_at: '2024-08-27T14:41:52.402Z',
            },
            {
              rank: '7',
              userId: '77212bb6-7793-4a9c-9a3e-ca03b8817dc5',
              username: 'testingleaderboard17',
              sumPoint: 17,
              updated_at: '2024-08-27T14:41:52.581Z',
            },
            {
              rank: '8',
              userId: 'df8ad83b-9a48-412c-9f41-f9e498e94902',
              username: 'testingleaderboard15',
              sumPoint: 15,
              updated_at: '2024-08-27T14:41:50.787Z',
            },
            {
              rank: '9',
              userId: 'c67a8304-d5b0-4d65-b8d6-d5282b802e5b',
              username: 'testingleaderboard14',
              sumPoint: 14,
              updated_at: '2024-08-27T14:41:50.969Z',
            },
            {
              rank: '10',
              userId: 'c3a06ea1-89ef-47b5-991e-4184bf5cb40c',
              username: 'testingleaderboard13',
              sumPoint: 13,
              updated_at: '2024-08-27T14:41:51.147Z',
            },
            {
              rank: '11',
              userId: 'c3d27027-7fea-4fa6-9ab3-7c78b9dd3da8',
              username: 'testingleaderboard12',
              sumPoint: 12,
              updated_at: '2024-08-27T14:41:51.327Z',
            },
            {
              rank: '12',
              userId: 'd5faf596-5f86-4054-854f-bff2e2c33a83',
              username: 'testingleaderboard11',
              sumPoint: 11,
              updated_at: '2024-08-27T14:41:51.506Z',
            },
            {
              rank: '13',
              userId: 'dcee2bbf-6e16-4f42-99ec-014fcfb63fff',
              username: 'testingleaderboard9',
              sumPoint: 9,
              updated_at: '2024-08-27T14:40:46.764Z',
            },
            {
              rank: '14',
              userId: '8bc8b4cf-1930-430e-ad1e-55169151737b',
              username: 'testingleaderboard8',
              sumPoint: 8,
              updated_at: '2024-08-27T14:40:46.946Z',
            },
            {
              rank: '15',
              userId: '07cc429c-fe6b-47a3-b2f7-e858e95923ef',
              username: 'testingleaderboard7',
              sumPoint: 7,
              updated_at: '2024-08-27T14:40:47.125Z',
            },
            {
              rank: '16',
              userId: 'e9354f94-9b10-4dbf-be5b-2eb21c08fa62',
              username: 'testingleaderboard6',
              sumPoint: 6,
              updated_at: '2024-08-27T14:40:47.304Z',
            },
            {
              rank: '17',
              userId: 'f28b9e7e-7ed9-402b-a938-208088d2065d',
              username: 'testingleaderboard5',
              sumPoint: 5,
              updated_at: '2024-08-27T14:40:47.492Z',
            },
            {
              rank: '18',
              userId: '67cc3af8-3996-4ba2-a41a-1b8b7e62b8bb',
              username: 'testingleaderboard4',
              sumPoint: 4,
              updated_at: '2024-08-27T14:40:47.672Z',
            },
            {
              rank: '19',
              userId: '0af747c4-da4d-4f01-970c-583a727a7f30',
              username: 'testingleaderboard3',
              sumPoint: 3,
              updated_at: '2024-08-27T14:40:47.851Z',
            },
            {
              rank: '20',
              userId: 'f0dfaaf3-98ac-41d4-8a80-d449b85fde05',
              username: 'testingleaderboard2',
              sumPoint: 2,
              updated_at: '2024-08-27T14:39:57.124Z',
            },
          ],
          loggedInUser: {
            rank: '1',
            userId: 'a1773542-5766-4750-a7cc-9dc6b341f903',
            username: 'invipirate',
            sumPoint: 22,
            updated_at: '2024-08-27T07:38:43.741Z',
          },
        },
      },
    },
  })
  weeklyLeaderboard(@Req() req, @Res() res: Response) {
    return this.leaderboardService.weeklyLeaderboard(req.user.id, res);
  }

  @Get('/monthly-leaderboard')
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Success',
    schema: {
      example: {
        responseMessage: 'Get Top Monthly Leaderboard Success',
        data: {
          topUsers: [
            {
              rank: '1',
              userId: 'a1773542-5766-4750-a7cc-9dc6b341f903',
              username: 'invipirate',
              sumPoint: 22,
              updated_at: '2024-08-27T07:38:43.741Z',
            },
            {
              rank: '2',
              userId: 'acba0d2a-f9a4-4234-a1d5-3bb5e732284e',
              username: 'testingleaderboard21',
              sumPoint: 22,
              updated_at: '2024-08-27T13:41:51.864Z',
            },
            {
              rank: '3',
              userId: '28fafed9-017a-4fb4-9b76-78258238bf1e',
              username: 'testingleaderboard22',
              sumPoint: 22,
              updated_at: '2024-08-27T14:41:51.685Z',
            },
            {
              rank: '4',
              userId: '3523eae6-8508-482f-9512-d96502e968d7',
              username: 'testingleaderboard20',
              sumPoint: 20,
              updated_at: '2024-08-27T14:41:52.044Z',
            },
            {
              rank: '5',
              userId: '0e498fd0-a0af-4754-beb4-29d6f7d095ac',
              username: 'testingleaderboard19',
              sumPoint: 19,
              updated_at: '2024-08-27T14:41:52.223Z',
            },
            {
              rank: '6',
              userId: 'c1be1813-3626-411b-8b67-811ee99a10dd',
              username: 'testingleaderboard18',
              sumPoint: 18,
              updated_at: '2024-08-27T14:41:52.402Z',
            },
            {
              rank: '7',
              userId: '77212bb6-7793-4a9c-9a3e-ca03b8817dc5',
              username: 'testingleaderboard17',
              sumPoint: 17,
              updated_at: '2024-08-27T14:41:52.581Z',
            },
            {
              rank: '8',
              userId: 'df8ad83b-9a48-412c-9f41-f9e498e94902',
              username: 'testingleaderboard15',
              sumPoint: 15,
              updated_at: '2024-08-27T14:41:50.787Z',
            },
            {
              rank: '9',
              userId: 'c67a8304-d5b0-4d65-b8d6-d5282b802e5b',
              username: 'testingleaderboard14',
              sumPoint: 14,
              updated_at: '2024-08-27T14:41:50.969Z',
            },
            {
              rank: '10',
              userId: 'c3a06ea1-89ef-47b5-991e-4184bf5cb40c',
              username: 'testingleaderboard13',
              sumPoint: 13,
              updated_at: '2024-08-27T14:41:51.147Z',
            },
            {
              rank: '11',
              userId: 'c3d27027-7fea-4fa6-9ab3-7c78b9dd3da8',
              username: 'testingleaderboard12',
              sumPoint: 12,
              updated_at: '2024-08-27T14:41:51.327Z',
            },
            {
              rank: '12',
              userId: 'd5faf596-5f86-4054-854f-bff2e2c33a83',
              username: 'testingleaderboard11',
              sumPoint: 11,
              updated_at: '2024-08-27T14:41:51.506Z',
            },
            {
              rank: '13',
              userId: 'dcee2bbf-6e16-4f42-99ec-014fcfb63fff',
              username: 'testingleaderboard9',
              sumPoint: 9,
              updated_at: '2024-08-27T14:40:46.764Z',
            },
            {
              rank: '14',
              userId: '8bc8b4cf-1930-430e-ad1e-55169151737b',
              username: 'testingleaderboard8',
              sumPoint: 8,
              updated_at: '2024-08-27T14:40:46.946Z',
            },
            {
              rank: '15',
              userId: '07cc429c-fe6b-47a3-b2f7-e858e95923ef',
              username: 'testingleaderboard7',
              sumPoint: 7,
              updated_at: '2024-08-27T14:40:47.125Z',
            },
            {
              rank: '16',
              userId: 'e9354f94-9b10-4dbf-be5b-2eb21c08fa62',
              username: 'testingleaderboard6',
              sumPoint: 6,
              updated_at: '2024-08-27T14:40:47.304Z',
            },
            {
              rank: '17',
              userId: 'f28b9e7e-7ed9-402b-a938-208088d2065d',
              username: 'testingleaderboard5',
              sumPoint: 5,
              updated_at: '2024-08-27T14:40:47.492Z',
            },
            {
              rank: '18',
              userId: '67cc3af8-3996-4ba2-a41a-1b8b7e62b8bb',
              username: 'testingleaderboard4',
              sumPoint: 4,
              updated_at: '2024-08-27T14:40:47.672Z',
            },
            {
              rank: '19',
              userId: '0af747c4-da4d-4f01-970c-583a727a7f30',
              username: 'testingleaderboard3',
              sumPoint: 3,
              updated_at: '2024-08-27T14:40:47.851Z',
            },
            {
              rank: '20',
              userId: 'f0dfaaf3-98ac-41d4-8a80-d449b85fde05',
              username: 'testingleaderboard2',
              sumPoint: 2,
              updated_at: '2024-08-27T14:39:57.124Z',
            },
          ],
          loggedInUser: {
            rank: '1',
            userId: 'a1773542-5766-4750-a7cc-9dc6b341f903',
            username: 'invipirate',
            sumPoint: 22,
            updated_at: '2024-08-27T07:38:43.741Z',
          },
        },
      },
    },
  })
  monthlyLeaderboard(@Req() req, @Res() res: Response) {
    return this.leaderboardService.monthlyLeaderboard(req.user.id, res);
  }

  @Get('/yearly-leaderboard')
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Success',
    schema: {
      example: {
        responseMessage: 'Get Top Yearly Leaderboard Success',
        data: {
          topUsers: [
            {
              rank: '1',
              userId: 'a1773542-5766-4750-a7cc-9dc6b341f903',
              username: 'invipirate',
              sumPoint: 22,
              updated_at: '2024-08-27T07:38:43.741Z',
            },
            {
              rank: '2',
              userId: 'acba0d2a-f9a4-4234-a1d5-3bb5e732284e',
              username: 'testingleaderboard21',
              sumPoint: 22,
              updated_at: '2024-08-27T13:41:51.864Z',
            },
            {
              rank: '3',
              userId: '28fafed9-017a-4fb4-9b76-78258238bf1e',
              username: 'testingleaderboard22',
              sumPoint: 22,
              updated_at: '2024-08-27T14:41:51.685Z',
            },
            {
              rank: '4',
              userId: '3523eae6-8508-482f-9512-d96502e968d7',
              username: 'testingleaderboard20',
              sumPoint: 20,
              updated_at: '2024-08-27T14:41:52.044Z',
            },
            {
              rank: '5',
              userId: '0e498fd0-a0af-4754-beb4-29d6f7d095ac',
              username: 'testingleaderboard19',
              sumPoint: 19,
              updated_at: '2024-08-27T14:41:52.223Z',
            },
            {
              rank: '6',
              userId: 'c1be1813-3626-411b-8b67-811ee99a10dd',
              username: 'testingleaderboard18',
              sumPoint: 18,
              updated_at: '2024-08-27T14:41:52.402Z',
            },
            {
              rank: '7',
              userId: '77212bb6-7793-4a9c-9a3e-ca03b8817dc5',
              username: 'testingleaderboard17',
              sumPoint: 17,
              updated_at: '2024-08-27T14:41:52.581Z',
            },
            {
              rank: '8',
              userId: 'df8ad83b-9a48-412c-9f41-f9e498e94902',
              username: 'testingleaderboard15',
              sumPoint: 15,
              updated_at: '2024-08-27T14:41:50.787Z',
            },
            {
              rank: '9',
              userId: 'c67a8304-d5b0-4d65-b8d6-d5282b802e5b',
              username: 'testingleaderboard14',
              sumPoint: 14,
              updated_at: '2024-08-27T14:41:50.969Z',
            },
            {
              rank: '10',
              userId: 'c3a06ea1-89ef-47b5-991e-4184bf5cb40c',
              username: 'testingleaderboard13',
              sumPoint: 13,
              updated_at: '2024-08-27T14:41:51.147Z',
            },
            {
              rank: '11',
              userId: 'c3d27027-7fea-4fa6-9ab3-7c78b9dd3da8',
              username: 'testingleaderboard12',
              sumPoint: 12,
              updated_at: '2024-08-27T14:41:51.327Z',
            },
            {
              rank: '12',
              userId: 'd5faf596-5f86-4054-854f-bff2e2c33a83',
              username: 'testingleaderboard11',
              sumPoint: 11,
              updated_at: '2024-08-27T14:41:51.506Z',
            },
            {
              rank: '13',
              userId: 'dcee2bbf-6e16-4f42-99ec-014fcfb63fff',
              username: 'testingleaderboard9',
              sumPoint: 9,
              updated_at: '2024-08-27T14:40:46.764Z',
            },
            {
              rank: '14',
              userId: '8bc8b4cf-1930-430e-ad1e-55169151737b',
              username: 'testingleaderboard8',
              sumPoint: 8,
              updated_at: '2024-08-27T14:40:46.946Z',
            },
            {
              rank: '15',
              userId: '07cc429c-fe6b-47a3-b2f7-e858e95923ef',
              username: 'testingleaderboard7',
              sumPoint: 7,
              updated_at: '2024-08-27T14:40:47.125Z',
            },
            {
              rank: '16',
              userId: 'e9354f94-9b10-4dbf-be5b-2eb21c08fa62',
              username: 'testingleaderboard6',
              sumPoint: 6,
              updated_at: '2024-08-27T14:40:47.304Z',
            },
            {
              rank: '17',
              userId: 'f28b9e7e-7ed9-402b-a938-208088d2065d',
              username: 'testingleaderboard5',
              sumPoint: 5,
              updated_at: '2024-08-27T14:40:47.492Z',
            },
            {
              rank: '18',
              userId: '67cc3af8-3996-4ba2-a41a-1b8b7e62b8bb',
              username: 'testingleaderboard4',
              sumPoint: 4,
              updated_at: '2024-08-27T14:40:47.672Z',
            },
            {
              rank: '19',
              userId: '0af747c4-da4d-4f01-970c-583a727a7f30',
              username: 'testingleaderboard3',
              sumPoint: 3,
              updated_at: '2024-08-27T14:40:47.851Z',
            },
            {
              rank: '20',
              userId: 'f0dfaaf3-98ac-41d4-8a80-d449b85fde05',
              username: 'testingleaderboard2',
              sumPoint: 2,
              updated_at: '2024-08-27T14:39:57.124Z',
            },
          ],
          loggedInUser: {
            rank: '1',
            userId: 'a1773542-5766-4750-a7cc-9dc6b341f903',
            username: 'invipirate',
            sumPoint: 22,
            updated_at: '2024-08-27T07:38:43.741Z',
          },
        },
      },
    },
  })
  yearlyLeaderboard(@Req() req, @Res() res: Response) {
    return this.leaderboardService.yearlyLeaderboard(req.user.id, res);
  }
}

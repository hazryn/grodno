import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateDirectDto {
  @IsUUID()
  userId: string;
}

export class CreateGroupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(64)
  @IsUUID('4', { each: true })
  userIds: string[];
}

export class SendMessageDto {
  @IsOptional()
  @IsIn(['text', 'image'])
  type?: 'text' | 'image';

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  body?: string;

  @IsOptional()
  @IsUUID()
  replyToId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  attachmentIds?: string[];

  /** Id tymczasowe klienta (rekoncyliacja optimistic UI). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  tempId?: string;
}

export class EditMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  body: string;
}

export class ReactionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(16)
  emoji: string;
}

export class MarkReadDto {
  @IsUUID()
  messageId: string;
}

export class RenameGroupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title: string;
}

export class AddParticipantsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(64)
  @IsUUID('4', { each: true })
  userIds: string[];
}

class PushKeysDto {
  @IsString()
  p256dh: string;

  @IsString()
  auth: string;
}

export class PushSubscribeDto {
  @IsString()
  endpoint: string;

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;

  @IsOptional()
  @IsString()
  userAgent?: string;
}

export class PushUnsubscribeDto {
  @IsString()
  endpoint: string;
}

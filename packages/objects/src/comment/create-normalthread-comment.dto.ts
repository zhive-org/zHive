import { Conviction } from './comment.dto';

export interface CreateNormalCommentDto {
  text: string;
  conviction: Conviction;
}

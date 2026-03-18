export type SearchCryptoProjectResult = {
  id: string;
  name?: string;
  image?: {
    large: string;
    small: string;
    thumb: string;
  };
  symbol?: string;
};

export type SearchTwitterUserResult = {
  id: string;
  username?: string;
  name?: string;
  profileImageUrl?: string;
};

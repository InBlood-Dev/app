import { Profile, Match } from '../types';

export type RootStackParamList = {
  Onboarding: undefined;
  Auth: undefined;
  ProfileSetup: undefined;
  MainTabs: undefined;
  MatchScreen: { match: Match };
  ProfileDetail: { profile: Profile };
  ChatScreen: { matchId: string; profile: Profile };
  EditProfile: undefined;
  Settings: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
};

export type MainTabsParamList = {
  Feed: undefined;
  Discover: undefined;
  Add: undefined;
  Matches: undefined;
  Messages: undefined;
  Profile: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

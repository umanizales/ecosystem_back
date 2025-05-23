/**
 * @ignore
 */
export interface ZoomApiResponse {
  uuid: string;
  id: number;
  host_id: string;
  host_email: string;
  topic: string;
  type: number;
  status: string;
  start_time: Date;
  duration: number;
  timezone: string;
  agenda: string;
  created_at: Date;
  start_url: string;
  join_url: string;
  password: string;
  h323_password: string;
  pstn_password: string;
  encrypted_password: string;
  settings: Settings;
  pre_schedule: boolean;
}
/**
 * @ignore
 */
export interface Settings {
  host_video: boolean;
  participant_video: boolean;
  cn_meeting: boolean;
  in_meeting: boolean;
  join_before_host: boolean;
  jbh_time: number;
  mute_upon_entry: boolean;
  watermark: boolean;
  use_pmi: boolean;
  approval_type: number;
  audio: string;
  auto_recording: string;
  enforce_login: boolean;
  enforce_login_domains: string;
  alternative_hosts: string;
  alternative_host_update_polls: boolean;
  close_registration: boolean;
  show_share_button: boolean;
  allow_multiple_devices: boolean;
  registrants_confirmation_email: boolean;
  waiting_room: boolean;
  request_permission_to_unmute_participants: boolean;
  registrants_email_notification: boolean;
  meeting_authentication: boolean;
  authentication_option: string;
  authentication_name: string;
  authentication_domains: string;
  encryption_type: string;
  approved_or_denied_countries_or_regions: ApprovedOrDeniedCountriesOrRegions;
  breakout_room: ApprovedOrDeniedCountriesOrRegions;
  internal_meeting: boolean;
  continuous_meeting_chat: ContinuousMeetingChat;
  participant_focused_meeting: boolean;
  push_change_to_calendar: boolean;
  resources: Array<null[]>;
  alternative_hosts_email_notification: boolean;
  show_join_info: boolean;
  device_testing: boolean;
  focus_mode: boolean;
  enable_dedicated_group_chat: boolean;
  private_meeting: boolean;
  calendar_type: number;
  email_notification: boolean;
  host_save_video_order: boolean;
  sign_language_interpretation: ApprovedOrDeniedCountriesOrRegions;
  email_in_attendee_report: boolean;
}
/**
 * @ignore
 */
export interface ApprovedOrDeniedCountriesOrRegions {
  enable: boolean;
}
/**
 * @ignore
 */
export interface ContinuousMeetingChat {
  enable: boolean;
  auto_add_invited_external_users: boolean;
}

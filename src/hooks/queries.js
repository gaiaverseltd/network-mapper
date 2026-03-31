/**
 * TanStack Query hooks for all Firestore data fetching.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  get_userdata,
  get_userdatabyname,
  Get_notification,
  getallpost,
  getallprofile,
  getpostdata,
  getpostdatabyuid,
  getConversation,
  getConversationsForUser,
  getUnreadMessageCount,
  getTagCategories,
  getTagsByCategoryId,
  getClassificationTagOptions,
  getCustomFields,
  getCustomFieldsForProfile,
  getCustomFieldsForPost,
  sendMessage,
  markConversationAsRead,
} from "../service/Auth/database";

export const queryKeys = {
  user: (uid) => ["user", uid],
  userByUsername: (username) => ["userByUsername", username],
  notifications: (uid) => ["notifications", uid],
  allPosts: () => ["posts"],
  allProfiles: () => ["profiles"],
  postData: (username, postid) => ["post", username, postid],
  postDataByUid: (uid, postid) => ["postByUid", uid, postid],
  conversations: (uid) => ["conversations", uid],
  conversation: (uid1, uid2) => ["conversation", uid1, uid2],
  unreadMessageCount: (uid) => ["unreadMessageCount", uid],
  tagCategories: () => ["tagCategories"],
  tagsByCategory: (categoryId) => ["tags", categoryId],
  classificationTagOptions: () => ["classificationTagOptions"],
  customFields: () => ["customFields"],
  customFieldsForProfile: () => ["customFieldsForProfile"],
  customFieldsForPost: () => ["customFieldsForPost"],
};

export const useUserData = (uid, options = {}) =>
  useQuery({
    queryKey: queryKeys.user(uid),
    queryFn: () => get_userdata(uid),
    enabled: !!uid,
    ...options,
  });

export const useUserByUsername = (username, options = {}) =>
  useQuery({
    queryKey: queryKeys.userByUsername(username),
    queryFn: () => get_userdatabyname(username),
    enabled: !!username?.trim?.(),
    ...options,
  });

export const useNotifications = (uid, options = {}) =>
  useQuery({
    queryKey: queryKeys.notifications(uid),
    queryFn: () => Get_notification(uid),
    enabled: !!uid,
    ...options,
  });

export const useAllPosts = (options = {}) =>
  useQuery({
    queryKey: queryKeys.allPosts(),
    queryFn: async () => {
      const posts = await getallpost();
      return posts.flat().sort((a, b) => {
        const dateA = a.postedat?.toDate?.() || new Date(a.postedat);
        const dateB = b.postedat?.toDate?.() || new Date(b.postedat);
        return dateB - dateA;
      });
    },
    ...options,
  });

export const useAllProfiles = (options = {}) =>
  useQuery({
    queryKey: queryKeys.allProfiles(),
    queryFn: getallprofile,
    ...options,
  });

export const usePostData = (username, postid, options = {}) =>
  useQuery({
    queryKey: queryKeys.postData(username, postid),
    queryFn: () => getpostdata(username, postid),
    enabled: !!(username && postid),
    ...options,
  });

export const usePostDataByUid = (uid, postid, options = {}) =>
  useQuery({
    queryKey: queryKeys.postDataByUid(uid, postid),
    queryFn: () => getpostdatabyuid(uid, postid),
    enabled: !!(uid && postid),
    ...options,
  });

export const useConversations = (uid, options = {}) =>
  useQuery({
    queryKey: queryKeys.conversations(uid),
    queryFn: async () => {
      const list = await getConversationsForUser(uid);
      return Promise.all(
        list.map(async (c) => ({
          ...c,
          profile: await get_userdata(c.otherUid),
        }))
      );
    },
    enabled: !!uid,
    ...options,
  });

export const useConversation = (uid1, uid2, options = {}) =>
  useQuery({
    queryKey: queryKeys.conversation(uid1, uid2),
    queryFn: () => getConversation(uid1, uid2),
    enabled: !!(uid1 && uid2),
    ...options,
  });

export const useUnreadMessageCount = (uid, options = {}) =>
  useQuery({
    queryKey: queryKeys.unreadMessageCount(uid),
    queryFn: () => getUnreadMessageCount(uid),
    enabled: !!uid,
    ...options,
  });

export const useSendMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fromUid, toUid, text, attachments }) => sendMessage(fromUid, toUid, text, attachments),
    onSuccess: (_, { fromUid, toUid }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations(fromUid) });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations(toUid) });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversation(fromUid, toUid) });
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadMessageCount(toUid) });
    },
  });
};

export const useMarkConversationAsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ myUid, otherUid }) => markConversationAsRead(myUid, otherUid),
    onSuccess: (_, { myUid }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations(myUid) });
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadMessageCount(myUid) });
    },
  });
};

export const useTagCategories = (options = {}) =>
  useQuery({
    queryKey: queryKeys.tagCategories(),
    queryFn: getTagCategories,
    ...options,
  });

export const useTagsByCategoryId = (categoryId, options = {}) =>
  useQuery({
    queryKey: queryKeys.tagsByCategory(categoryId),
    queryFn: () => getTagsByCategoryId(categoryId),
    enabled: !!categoryId,
    ...options,
  });

export const useClassificationTagOptions = (options = {}) =>
  useQuery({
    queryKey: queryKeys.classificationTagOptions(),
    queryFn: getClassificationTagOptions,
    ...options,
  });

export const useCustomFields = (options = {}) =>
  useQuery({
    queryKey: queryKeys.customFields(),
    queryFn: getCustomFields,
    ...options,
  });

export const useCustomFieldsForProfile = (options = {}) =>
  useQuery({
    queryKey: queryKeys.customFieldsForProfile(),
    queryFn: getCustomFieldsForProfile,
    ...options,
  });

export const useCustomFieldsForPost = (options = {}) =>
  useQuery({
    queryKey: queryKeys.customFieldsForPost(),
    queryFn: getCustomFieldsForPost,
    ...options,
  });

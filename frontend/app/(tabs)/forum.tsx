import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal,
  KeyboardAvoidingView, Platform, ImageBackground, ScrollView, Alert, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth';
import { fxTap, fxSuccess, fxError } from '@/src/utils/fx';

const ADMIN_NAMES = new Set(['rydersworld', 'greenboottap']);

type Post = { id: string; user_id: string; author: string; title: string; body: string; media_url?: string | null; media_type?: string | null; likes: number; comments_count: number; created_at: string };
type Comment = { id: string; author: string; text: string; created_at: string };

export default function ForumScreen() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | ''>('');
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  const fetchPosts = useCallback(async () => {
    setRefreshing(true);
    try { setPosts(await api<Post[]>('/forum/posts')); } catch (e) { console.warn(e); }
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const create = async () => {
    if (!title.trim() || !body.trim()) { Alert.alert('Missing fields', 'Title and body are required.'); return; }
    try {
      await api('/forum/posts', { method: 'POST', body: {
        title: title.trim(), body: body.trim(),
        media_url: mediaUrl.trim() || null, media_type: mediaType || null,
      } });
      setTitle(''); setBody(''); setMediaUrl(''); setMediaType('');
      setComposerOpen(false);
      await fetchPosts();
    } catch (e: any) { Alert.alert('Error', e?.message || 'Failed'); }
  };

  const like = async (id: string) => {
    fxTap();
    try {
      const updated = await api<Post>(`/forum/posts/${id}/like`, { method: 'POST', body: {} });
      setPosts((p) => p.map((x) => (x.id === id ? updated : x)));
      if (openPost?.id === id) setOpenPost(updated);
    } catch (e) { console.warn(e); }
  };

  const adminDeletePost = async (id: string) => {
    fxTap();
    Alert.alert('Delete post?', 'This permanently removes the post + all comments.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'DELETE', style: 'destructive', onPress: async () => {
        try {
          await api(`/admin/forum/posts/${id}`, { method: 'DELETE' });
          fxSuccess();
          setPosts((arr) => arr.filter((p) => p.id !== id));
          if (openPost?.id === id) setOpenPost(null);
        } catch (e: any) { fxError(); Alert.alert('Error', e?.message || 'Failed'); }
      } },
    ]);
  };

  const adminDeleteComment = async (cid: string) => {
    fxTap();
    try {
      await api(`/admin/forum/comments/${cid}`, { method: 'DELETE' });
      fxSuccess();
      setComments((arr) => arr.filter((c) => c.id !== cid));
    } catch (e: any) { fxError(); Alert.alert('Error', e?.message || 'Failed'); }
  };

  const openThread = async (p: Post) => {
    setOpenPost(p);
    setLoadingComments(true);
    try { setComments(await api<Comment[]>(`/forum/posts/${p.id}/comments`)); } catch (e) { console.warn(e); }
    setLoadingComments(false);
  };

  const addComment = async () => {
    if (!openPost || !commentText.trim()) return;
    try {
      const c = await api<Comment>(`/forum/posts/${openPost.id}/comments`, {
        method: 'POST', body: { text: commentText.trim() },
      });
      setComments((cs) => [...cs, c]);
      setCommentText('');
      setPosts((p) => p.map((x) => (x.id === openPost.id ? { ...x, comments_count: x.comments_count + 1 } : x)));
      setOpenPost({ ...openPost, comments_count: openPost.comments_count + 1 });
    } catch (e) { console.warn(e); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']} testID="forum-screen">
      <ImageBackground source={{ uri: theme.media.stone }} resizeMode="repeat" style={styles.bg} imageStyle={{ opacity: 0.15 }}>
        <View style={styles.headerBar}>
          <Text style={styles.h1}>COMMUNITY</Text>
          <TouchableOpacity testID="open-composer-btn" onPress={() => setComposerOpen(true)} style={styles.newBtn}>
            <Ionicons name="add" size={20} color="#000" />
            <Text style={styles.newBtnTxt}>NEW</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 60 }}
          data={posts}
          keyExtractor={(p) => p.id}
          refreshing={refreshing}
          onRefresh={fetchPosts}
          ListEmptyComponent={<Text style={styles.empty}>No posts yet — be first to share a strat.</Text>}
          renderItem={({ item }) => {
            const authorIsAdmin = ADMIN_NAMES.has(item.author.toLowerCase());
            return (
            <TouchableOpacity testID={`post-${item.id}`} activeOpacity={0.7} onPress={() => openThread(item)} style={styles.postCard}>
              <Text style={styles.postTitle} numberOfLines={2}>{item.title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.postAuthor}>BY {item.author.toUpperCase()}</Text>
                {authorIsAdmin && (
                  <View style={styles.adminBadge}>
                    <Ionicons name="shield-checkmark" size={9} color="#000" />
                    <Text style={styles.adminBadgeTxt}>ADMIN</Text>
                  </View>
                )}
              </View>
              {item.media_type === 'image' && item.media_url ? (
                <Image source={{ uri: item.media_url }} style={styles.postImage} resizeMode="cover" />
              ) : null}
              {item.media_type === 'video' && item.media_url ? (
                <View style={styles.videoTag}>
                  <Ionicons name="videocam" size={14} color="#fff" />
                  <Text style={styles.videoTagText}>VIDEO CLIP</Text>
                </View>
              ) : null}
              <Text style={styles.postBody} numberOfLines={3}>{item.body}</Text>
              <View style={styles.postFooter}>
                <TouchableOpacity testID={`like-${item.id}`} onPress={() => like(item.id)} style={styles.iconBtn}>
                  <Ionicons name="flame" size={16} color={theme.colors.redstone} />
                  <Text style={styles.iconText}>{item.likes}</Text>
                </TouchableOpacity>
                <View style={styles.iconBtn}>
                  <Ionicons name="chatbubble" size={16} color={theme.colors.diamond} />
                  <Text style={styles.iconText}>{item.comments_count}</Text>
                </View>
                {user?.is_admin && (
                  <TouchableOpacity testID={`mod-delete-${item.id}`} onPress={(e: any) => { e?.stopPropagation?.(); adminDeletePost(item.id); }} style={[styles.iconBtn, { marginLeft: 'auto', backgroundColor: theme.colors.redstone, borderColor: '#9b1c1c', borderWidth: 2, paddingHorizontal: 8, paddingVertical: 4 }]}>
                    <Ionicons name="trash" size={13} color="#fff" />
                    <Text style={[styles.iconText, { color: '#fff' }]}>MOD DELETE</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
            );
          }}
        />

        <Modal visible={composerOpen} transparent animationType="slide" onRequestClose={() => setComposerOpen(false)}>
          <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
              <View style={styles.modal} testID="composer-modal">
                <Text style={styles.modalTitle}>NEW POST</Text>
                <TextInput testID="composer-title" value={title} onChangeText={setTitle}
                  placeholder="TITLE" placeholderTextColor={theme.colors.textSecondary} style={styles.input} />
                <TextInput testID="composer-body" value={body} onChangeText={setBody} multiline
                  placeholder="SHARE YOUR STRATEGY..." placeholderTextColor={theme.colors.textSecondary}
                  style={[styles.input, { height: 100, textAlignVertical: 'top' }]} />
                <TextInput testID="composer-media-url" value={mediaUrl} onChangeText={setMediaUrl}
                  placeholder="MEDIA URL (OPTIONAL — IMAGE/VIDEO LINK)" autoCapitalize="none"
                  placeholderTextColor={theme.colors.textSecondary} style={styles.input} />
                {mediaUrl.trim() ? (
                  <View style={styles.typeRow}>
                    {(['image', 'video'] as const).map((t) => (
                      <TouchableOpacity key={t} testID={`media-type-${t}`} onPress={() => setMediaType(mediaType === t ? '' : t)}
                        style={[styles.typeBtn, mediaType === t && styles.typeBtnActive]}>
                        <Ionicons name={t === 'image' ? 'image' : 'videocam'} size={14} color={mediaType === t ? '#fff' : theme.colors.textSecondary} />
                        <Text style={[styles.typeText, mediaType === t && { color: '#fff' }]}>{t.toUpperCase()}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  <TouchableOpacity testID="cancel-post-btn" onPress={() => setComposerOpen(false)} style={[styles.btn, styles.btnGray]}>
                    <Text style={styles.btnTxt}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity testID="submit-post-btn" onPress={create} style={[styles.btn, styles.btnPrimary]}>
                    <Text style={styles.btnTxt}>POST</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>

        <Modal visible={!!openPost} transparent animationType="slide" onRequestClose={() => setOpenPost(null)}>
          <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.thread} testID="thread-modal">
              <View style={styles.threadHeader}>
                <Text style={styles.modalTitle} numberOfLines={2}>{openPost?.title}</Text>
                <TouchableOpacity testID="close-thread-btn" onPress={() => setOpenPost(null)}>
                  <Ionicons name="close" size={24} color={theme.colors.gold} />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 400 }}>
                <Text style={styles.threadAuthor}>BY {openPost?.author.toUpperCase()}</Text>
                {openPost?.media_type === 'image' && openPost.media_url ? (
                  <Image source={{ uri: openPost.media_url }} style={styles.threadImage} resizeMode="contain" />
                ) : null}
                {openPost?.media_type === 'video' && openPost.media_url ? (
                  <View style={styles.videoLink}>
                    <Ionicons name="videocam" size={18} color={theme.colors.diamond} />
                    <Text style={styles.videoLinkText} numberOfLines={1}>{openPost.media_url}</Text>
                  </View>
                ) : null}
                <Text style={styles.threadBody}>{openPost?.body}</Text>
                <View style={styles.divider} />
                <Text style={styles.commentsHeader}>COMMENTS ({comments.length})</Text>
                {loadingComments && <ActivityIndicator color={theme.colors.gold} />}
                {comments.map((c) => (
                  <View key={c.id} style={styles.comment}>
                    <Text style={styles.commentAuthor}>{c.author}</Text>
                    <Text style={styles.commentText}>{c.text}</Text>
                  </View>
                ))}
              </ScrollView>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                <TextInput testID="comment-input" value={commentText} onChangeText={setCommentText}
                  placeholder="ADD COMMENT..." placeholderTextColor={theme.colors.textSecondary}
                  style={[styles.input, { flex: 1 }]} />
                <TouchableOpacity testID="submit-comment-btn" onPress={addComment} style={[styles.btn, styles.btnPrimary, { paddingHorizontal: 16 }]}>
                  <Ionicons name="send" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  bg: { flex: 1 },
  headerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing.md, backgroundColor: theme.colors.dirtDark, borderBottomColor: theme.colors.borderDark, borderBottomWidth: 4 },
  h1: { fontFamily: theme.font, fontSize: 20, fontWeight: 'bold', color: theme.colors.gold, textTransform: 'uppercase', letterSpacing: 2 },
  newBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.gold, borderColor: '#8b5a2b', borderWidth: 2, borderBottomWidth: 4, paddingHorizontal: 10, paddingVertical: 6, gap: 4 },
  newBtnTxt: { fontFamily: theme.font, fontSize: 12, fontWeight: 'bold', color: '#000' },
  empty: { fontFamily: theme.font, color: theme.colors.textSecondary, textAlign: 'center', padding: 24 },
  postCard: { backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark, borderWidth: 4, padding: theme.spacing.md, marginBottom: theme.spacing.sm },
  postTitle: { fontFamily: theme.font, fontSize: 16, color: theme.colors.gold, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
  postAuthor: { fontFamily: theme.font, fontSize: 10, color: theme.colors.diamond, marginBottom: 8 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: theme.colors.gold, borderColor: '#000', borderWidth: 1, paddingHorizontal: 5, paddingVertical: 2, marginBottom: 8 },
  adminBadgeTxt: { fontFamily: theme.font, fontSize: 9, color: '#000', fontWeight: 'bold', letterSpacing: 1 },
  postImage: { width: '100%', height: 180, marginBottom: 8, borderWidth: 2, borderColor: theme.colors.borderDark },
  videoTag: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 4, backgroundColor: theme.colors.redstone, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 8 },
  videoTagText: { fontFamily: theme.font, fontSize: 10, color: '#fff', fontWeight: 'bold' },
  postBody: { fontFamily: theme.font, fontSize: 12, color: theme.colors.text, lineHeight: 17 },
  postFooter: { flexDirection: 'row', gap: 16, marginTop: 12, paddingTop: 8, borderTopColor: theme.colors.borderDark, borderTopWidth: 2 },
  iconBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconText: { fontFamily: theme.font, fontSize: 12, color: theme.colors.text, fontWeight: 'bold' },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', padding: 16 },
  modal: { backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark, borderWidth: 4, padding: theme.spacing.md },
  thread: { backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark, borderWidth: 4, padding: theme.spacing.md, maxHeight: '85%', marginTop: 'auto', marginBottom: 'auto' },
  threadHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  threadAuthor: { fontFamily: theme.font, fontSize: 11, color: theme.colors.diamond, marginBottom: 8 },
  threadImage: { width: '100%', height: 220, marginBottom: 8, borderWidth: 2, borderColor: theme.colors.borderDark },
  videoLink: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.obsidian, borderColor: theme.colors.borderDark, borderWidth: 2, padding: 8, marginBottom: 8 },
  videoLinkText: { flex: 1, fontFamily: theme.font, fontSize: 11, color: theme.colors.diamond, textDecorationLine: 'underline' },
  threadBody: { fontFamily: theme.font, fontSize: 13, color: theme.colors.text, lineHeight: 19 },
  divider: { height: 2, backgroundColor: theme.colors.borderDark, marginVertical: 12 },
  commentsHeader: { fontFamily: theme.font, fontSize: 13, color: theme.colors.gold, fontWeight: 'bold', marginBottom: 8 },
  comment: { backgroundColor: theme.colors.obsidian, borderColor: theme.colors.borderDark, borderWidth: 2, padding: 8, marginBottom: 6 },
  commentAuthor: { fontFamily: theme.font, fontSize: 10, color: theme.colors.emerald, fontWeight: 'bold' },
  commentText: { fontFamily: theme.font, fontSize: 12, color: theme.colors.text, marginTop: 2 },
  modalTitle: { fontFamily: theme.font, fontSize: 18, fontWeight: 'bold', color: theme.colors.gold, textTransform: 'uppercase', marginBottom: 12, flex: 1, marginRight: 8 },
  input: { backgroundColor: theme.colors.obsidian, borderColor: theme.colors.borderDark, borderWidth: 4, color: theme.colors.text, padding: 10, fontSize: 13, fontFamily: theme.font, marginBottom: 8 },
  typeRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  typeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: theme.colors.obsidian, borderColor: theme.colors.borderDark, borderWidth: 2 },
  typeBtnActive: { backgroundColor: theme.colors.emeraldDark, borderColor: theme.colors.emerald },
  typeText: { fontFamily: theme.font, fontSize: 11, color: theme.colors.textSecondary, fontWeight: 'bold' },
  btn: { flex: 1, borderWidth: 4, borderBottomWidth: 6, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: theme.colors.emerald, borderColor: theme.colors.emeraldDark },
  btnGray: { backgroundColor: theme.colors.stone, borderColor: theme.colors.borderDark },
  btnTxt: { fontFamily: theme.font, fontSize: 13, fontWeight: 'bold', color: '#fff', textTransform: 'uppercase' },
});

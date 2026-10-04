import React, { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { C, F, Ic, T, useHanken, useTheme } from '../theme/tokens';
import { db, BookmarkRecord } from '../db/database';

interface BookmarksModalProps {
  onClose: () => void;
  onSelectBookmark: (url: string) => void;
  currentUrl?: string;
  currentTitle?: string;
}

export default function BookmarksModal({
  onClose,
  onSelectBookmark,
  currentUrl,
  currentTitle,
}: BookmarksModalProps) {
  const ok = useHanken();
  const theme = useTheme();
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([]);

  useEffect(() => {
    loadBookmarks();
  }, []);

  async function loadBookmarks() {
    const list = await db.getBookmarks();
    setBookmarks(list);
  }

  async function handleAddCurrentPage() {
    if (!currentUrl || currentUrl.startsWith('about:')) return;
    await db.addBookmark(currentUrl, currentTitle || currentUrl);
    loadBookmarks();
  }

  async function handleDeleteBookmark(id: number) {
    await db.deleteBookmark(id);
    loadBookmarks();
  }

  if (!ok) return null;

  const rowBorder = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.sep };

  return (
    <View style={s.container}>
      <Pressable style={s.dim} onPress={onClose} />
      <View style={[s.sheet, { backgroundColor: theme.card }]}>
        <View style={[s.grabber, { backgroundColor: theme.isDark ? '#545458' : '#c7c7cc' }]} />
        <View style={s.head}>
          <View style={{ width: 60 }} />
          <T style={{ fontFamily: F.s, fontSize: 17, color: theme.text }}>Bookmarks</T>
          <Pressable style={{ width: 60, alignItems: 'flex-end' }} onPress={onClose}>
            <T style={{ color: theme.blue, fontFamily: F.s }}>Done</T>
          </Pressable>
        </View>

        {currentUrl && !currentUrl.startsWith('about:') && (
          <Pressable style={[s.addBtn, { backgroundColor: theme.cardElevated }]} onPress={handleAddCurrentPage}>
            <Ic n="plus" c={theme.blue} s={20} />
            <T style={{ color: theme.blue, fontFamily: F.m, fontSize: 15 }}>
              Bookmark this page
            </T>
          </Pressable>
        )}

        <ScrollView style={{ maxHeight: 380, marginTop: 10 }} showsVerticalScrollIndicator={false}>
          <View style={[s.grp, { backgroundColor: theme.cardElevated }]}>
            {bookmarks.length === 0 ? (
              <View style={[s.row, { justifyContent: 'center' }]}>
                <T style={{ color: theme.sec, fontSize: 15 }}>No bookmarks saved yet</T>
              </View>
            ) : (
              bookmarks.map((b, i) => (
                <View key={b.id} style={[s.row, i > 0 && rowBorder]}>
                  <Pressable
                    style={{ flex: 1, minWidth: 0 }}
                    onPress={() => {
                      onSelectBookmark(b.url);
                      onClose();
                    }}
                  >
                    <T numberOfLines={1} style={{ fontSize: 15, fontFamily: F.s, color: theme.text }}>
                      {b.title}
                    </T>
                    <T numberOfLines={1} style={[s.sub, { color: theme.sec }]}>
                      {b.url}
                    </T>
                  </Pressable>

                  <Pressable
                    onPress={() => handleDeleteBookmark(b.id)}
                    hitSlop={8}
                    style={{ padding: 4 }}
                  >
                    <Ic n="trash" c={theme.red} s={18} />
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 9999,
  },
  dim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: 520,
    backgroundColor: C.grouped,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'android' ? 55 : 32,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.gray,
    alignSelf: 'center',
    marginBottom: 10,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 36,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 12,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  grp: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    minHeight: 54,
    gap: 12,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.sep,
  },
  sub: {
    fontSize: 12,
    color: C.sec,
    marginTop: 2,
  },
});

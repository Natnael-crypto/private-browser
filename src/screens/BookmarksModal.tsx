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
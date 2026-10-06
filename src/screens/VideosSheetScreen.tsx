import React, { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, ScrollView, Image, Text } from 'react-native';
import { F, Ic, Play, T, useHanken, useTheme } from '../theme/tokens';
import { VideoRegistry, DetectedVideoItem } from '../video/videoRegistry';
import { DownloadManager, ActiveDownloadItem } from '../downloads/downloadManager';

interface VideosSheetProps {
  onClose: () => void;
  onOpenDownloads?: () => void;
  currentPageUrl?: string;
}

export default function VideosSheetScreen({ onClose, onOpenDownloads, currentPageUrl = '' }: VideosSheetProps) {
  const ok = useHanken();
  const theme = useTheme();
  const [items, setItems] = useState<DetectedVideoItem[]>([]);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [selectedResolutions, setSelectedResolutions] = useState<Record<string, string>>({});
  const [activeDownloads, setActiveDownloads] = useState<ActiveDownloadItem[]>([]);

  useEffect(() => {
    const unsubVideos = VideoRegistry.subscribe((videos) => {
      setItems(videos);
    });
    const unsubDownloads = DownloadManager.subscribe(() => {
      setActiveDownloads(DownloadManager.getActiveDownloads());
    });
    return () => {
      unsubVideos();
      unsubDownloads();
    };
  }, []);

  const displaySource = React.useMemo(() => {
    try {
      if (currentPageUrl) {
        const u = new URL(currentPageUrl);
        return `${u.hostname.replace('www.', '')}${u.pathname}`;
      }
    } catch {}
    return 'page/media';
  }, [currentPageUrl]);

  async function handleDownload(item: DetectedVideoItem) {
    if (item.protectedStream || item.hasDrm || item.type === 'embed') return;
    setDownloadingIds((prev) => new Set(prev).add(item.id));
    const chosenRes = selectedResolutions[item.id] || item.resolution;
    await DownloadManager.startDownload({
      ...item,
      resolution: chosenRes,
    });
    setTimeout(() => {
      onClose();
      if (onOpenDownloads) onOpenDownloads();
    }, 400);
  }

  function handleSelectQuality(itemId: string, quality: string) {
    setSelectedResolutions((prev) => ({ ...prev, [itemId]: quality }));
  }

  if (!ok) return null;

  const rowBorder = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.sep };

  return (
    <View style={s.container}>
      <Pressable style={s.dim} onPress={onClose} />
      <View style={[s.sheet, { backgroundColor: theme.card }]}>
        <View style={[s.grabber, { backgroundColor: theme.isDark ? '#545458' : '#c7c7cc' }]} />
        <View style={s.head}>
          <View style={{ width: 50 }} />
          <T style={{ fontFamily: F.s, fontSize: 17, color: theme.text }}>Videos on this page</T>
          <Pressable style={{ width: 50, alignItems: 'flex-end' }} onPress={onClose}>
            <T style={{ color: theme.blue, fontFamily: F.s }}>Done</T>
          </Pressable>
        </View>

        <T style={[s.sub, { textAlign: 'center', marginBottom: 14, color: theme.sec }]} numberOfLines={1}>
          {displaySource}
        </T>

        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
          <View style={[s.grp, { backgroundColor: theme.cardElevated }]}>
            {items.length === 0 ? (
              <View style={[s.row, { justifyContent: 'center' }]}>
                <T style={{ color: theme.sec, fontSize: 15 }}>No media detected on this page yet.</T>
              </View>
            ) : (
              items.map((it, i) => {
                const activeDl = activeDownloads.find((d) => d.videoId === it.id);
                const isDownloading = downloadingIds.has(it.id) || !!activeDl;
                const isEmbed = it.type === 'embed';
                const isProtected = it.protectedStream || it.hasDrm;
                const currentRes = selectedResolutions[it.id] || it.resolution;

                return (
                  <View key={it.id} style={[s.itemWrapper, i > 0 && rowBorder]}>
                    <View style={s.row}>
                      <View style={[s.thumb, { backgroundColor: theme.cardElevated, borderColor: theme.sep }]}>
                        {it.thumbnail ? (
                          <>
                            <Image source={{ uri: it.thumbnail }} style={s.thumbImg} resizeMode="cover" />
                            <View style={s.thumbOverlay}>
                              <View style={s.playBadge}>
                                <Play s={12} c="#ffffff" />
                              </View>
                            </View>
                          </>
                        ) : isProtected ? (
                          <Ic n="lock" c={theme.sec} s={20} />
                        ) : (
                          <View style={[s.posterContainer, { backgroundColor: theme.cardElevated }]}>
                            <View style={s.posterBadge}>
                              <Text style={s.posterBadgeText}>{it.format || 'MP4'}</Text>
                            </View>
                            <View style={s.playBadge}>
                              <Play s={12} c="#ffffff" />
                            </View>
                          </View>
                        )}
                      </View>

                      <View style={{ flex: 1, minWidth: 0 }}>
                        <T numberOfLines={1} style={{ fontSize: 15, fontFamily: F.s, color: theme.text }}>
                          {it.title}
                        </T>
                        <T style={[s.sub, { color: isProtected ? '#ff453a' : theme.sec }]}>
                          {isProtected ? 'Protected — can’t be downloaded' : it.metaFormatted}
                        </T>
                        {it.audioTracks && it.audioTracks.length > 0 && (
                          <T style={[s.sub, { color: theme.sec, fontSize: 11 }]}>
                            Audio: {it.audioTracks.join(', ')}
                          </T>
                        )}
                      </View>

                      {isProtected ? (
                        <View style={s.actionBtn}>
                          <Ic n="lock" c="#ff453a" s={20} />
                        </View>
                      ) : isEmbed ? (
                        <View style={[s.embedPill, { backgroundColor: theme.isDark ? '#2c2c2e' : '#e5e5ea' }]}>
                          <T style={{ fontSize: 12, color: theme.sec, fontFamily: F.m }}>Embed</T>
                        </View>
                      ) : (
                        <Pressable
                          style={s.actionBtn}
                          onPress={() => handleDownload(it)}
                          disabled={isDownloading}
                          hitSlop={10}
                          accessibilityLabel={isDownloading ? 'Downloading' : 'Download video'}
                        >
                          {isDownloading ? (
                            <Ic n="check" c={theme.green} s={22} w={2.4} />
                          ) : (
                            <Ic n="dl" c={theme.blue} s={22} w={2.2} />
                          )}
                        </Pressable>
                      )}
                    </View>

                    {/* Per-item Quality Picker (Section 5.5) */}
                    {!isProtected && !isEmbed && it.qualities && it.qualities.length > 1 && (
                      <View style={s.qualityRow}>
                        <T style={[s.qualityLabel, { color: theme.sec }]}>Quality:</T>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
                          {it.qualities.map((q) => {
                            const isSelected = q === currentRes;
                            return (
                              <Pressable
                                key={q}
                                onPress={() => handleSelectQuality(it.id, q)}
                                style={[
                                  s.qualityPill,
                                  {
                                    backgroundColor: isSelected
                                      ? theme.blue
                                      : theme.isDark
                                        ? '#2c2c2e'
                                        : '#e5e5ea',
                                  },
                                ]}
                              >
                                <T
                                  style={{
                                    fontSize: 12,
                                    fontFamily: F.m,
                                    color: isSelected ? '#ffffff' : theme.text,
                                  }}
                                >
                                  {q}
                                </T>
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                      </View>
                    )}
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

                    {/* Inline live download progress (Section 6.2) */}
                    {activeDl && (
                      <View style={s.inlineProgress}>
                        <View style={[s.progressBarBg, { backgroundColor: theme.sep }]}>
                          <View
                            style={[
                              s.progressBarFill,
                              {
                                width: `${Math.round(activeDl.progress * 100)}%`,
                                backgroundColor: theme.blue,
                              },
                            ]}
                          />
                        </View>
                        <View style={s.inlineMeta}>
                          <T style={{ fontSize: 11, color: theme.sec }}>
                            {activeDl.statusText}
                          </T>
                          {Boolean(activeDl.speedText) && (
                            <T style={{ fontSize: 11, color: theme.blue, fontFamily: F.m }}>
                              {activeDl.speedText}
                            </T>
                          )}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>

        <T style={[s.sub, { marginTop: 8, marginHorizontal: 32, textAlign: 'center', color: theme.sec }]}>
          Each download keeps this page’s address, so you can come back to the source later.
        </T>
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 34,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 10,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  sub: {
    fontSize: 13,
  },
  grp: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  itemWrapper: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumb: {
    width: 60,
    height: 42,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  thumbOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterBadge: {
    position: 'absolute',
    top: 2,
    left: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  posterBadgeText: {
    fontSize: 9,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  actionBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  embedPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  qualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  qualityLabel: {
    fontSize: 12,
  },
  qualityPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 6,
  },
  inlineProgress: {
    marginTop: 8,
  },
  progressBarBg: {
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
  inlineMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 3,
  },
});

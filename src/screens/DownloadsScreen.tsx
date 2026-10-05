import React, { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, ScrollView, TextInput, Image, BackHandler, Text, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { C, F, Ic, Play, T, useHanken, useTheme } from '../theme/tokens';
import {
  DownloadManager,
  ActiveDownloadItem,
  SavedVideoItem,
} from '../downloads/downloadManager';
import VideoPlayerModal from './VideoPlayerModal';
import {
  ActionSheetModal,
  ConfirmDialogModal,
  NoticeDialogModal,
} from '../components/AppModal';

interface VideoThumbnailViewProps {
  thumbnailUri?: string | null;
  fileUri?: string;
  videoId?: string;
  title?: string;
  theme: any;
  format?: string;
  resolution?: string;
}

function VideoThumbnailView({
  thumbnailUri,
  fileUri,
  videoId,
  theme,
  format = 'MP4',
  resolution,
}: VideoThumbnailViewProps) {
  const [generatedUri, setGeneratedUri] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!thumbnailUri && fileUri && videoId) {
      let active = true;
      DownloadManager.generateAndSaveThumbnail(videoId, fileUri).then((uri) => {
        if (active && uri) {
          setGeneratedUri(uri);
          setLoadError(false);
        }
      });
      return () => {
        active = false;
      };
    }
  }, [thumbnailUri, fileUri, videoId]);

  const currentUri = thumbnailUri || generatedUri;
  const hasImage = !!currentUri && !loadError;

  return (
    <View style={[s.thumb, { backgroundColor: theme.cardElevated, borderColor: theme.sep }]}>
      {hasImage ? (
        <>
          <Image
            source={{ uri: currentUri! }}
            style={s.thumbImg}
            resizeMode="cover"
            onError={() => setLoadError(true)}
          />
          <View style={s.thumbOverlay}>
            <View style={s.playBadge}>
              <Play s={12} c="#ffffff" />
            </View>
          </View>
          {resolution && (
            <View style={s.thumbResolutionBadge}>
              <Text style={s.thumbResolutionText}>{resolution}</Text>
            </View>
          )}
        </>
      ) : (
        <View style={[s.posterContainer, { backgroundColor: theme.cardElevated }]}>
          <View style={s.posterBadge}>
            <Text style={s.posterBadgeText}>{format.toUpperCase()}</Text>
          </View>
          <View style={s.playBadge}>
            <Play s={12} c="#ffffff" />
          </View>
        </View>
      )}
    </View>
  );
}

interface VideoDetailsSheetProps {
  item: ActiveDownloadItem | SavedVideoItem | null;
  visible: boolean;
  onClose: () => void;
  onOpenSourcePage?: (url: string) => void;
}

function VideoDetailsSheet({
  item,
  visible,
  onClose,
  onOpenSourcePage,
}: VideoDetailsSheetProps) {
  const theme = useTheme();
  if (!visible || !item) return null;

  const isActive = 'progress' in item;
  const activeItem = isActive ? (item as ActiveDownloadItem) : null;
  const savedItem = !isActive ? (item as SavedVideoItem) : null;

  const title = item.title;
  const resolution = item.resolution || (savedItem ? savedItem.meta.split('·')[0].trim() : '720p HD');
  const format = item.format || 'MP4';
  const sourceHost = 'sourceHost' in item ? item.sourceHost : (item as SavedVideoItem).source;
  const sourcePageUrl = item.sourcePageUrl;
  const fileUri = item.fileUri;

  const speedText = activeItem?.speedText || (activeItem?.state === 'paused' ? 'Paused' : '0 KB/s');
  const speedMbps = activeItem?.speedBytesPerSec && activeItem.speedBytesPerSec > 0
    ? `${(activeItem.speedBytesPerSec * 8 / (1024 * 1024)).toFixed(1)} Mbps`
    : null;

  const bytesDone = activeItem ? activeItem.bytesDone : (savedItem?.sizeBytes || 0);
  const totalBytes = activeItem ? activeItem.totalBytes : bytesDone;

  const bytesDoneMb = (bytesDone / (1024 * 1024)).toFixed(2);
  const totalBytesMb = (totalBytes / (1024 * 1024)).toFixed(2);
  const percentText = activeItem ? `${(activeItem.progress * 100).toFixed(1)}%` : '100%';
  const etaText = activeItem?.etaText || 'Completed';

  const destinationText = DownloadManager.getSaveDestination() === 'downloads'
    ? 'Phone Downloads'
    : 'App Secure Storage';

  return (
    <View style={s.detailsModalOverlay} pointerEvents="box-none">
      <Pressable style={s.detailsModalBackdrop} onPress={onClose} />
      <View style={[s.detailsModalSheet, { backgroundColor: theme.card }]}>
        <View style={[s.grabber, { backgroundColor: theme.isDark ? '#545458' : '#c7c7cc' }]} />

        <View style={s.detailsHeader}>
          <T style={[s.detailsHeaderTitle, { color: theme.text }]}>Video Information</T>
          <Pressable onPress={onClose} hitSlop={10} style={s.detailsCloseBtn}>
            <T style={{ color: theme.blue, fontFamily: F.s, fontSize: 16 }}>Done</T>
          </Pressable>
        </View>

        <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
          {/* Video Title Card */}
          <View style={[s.detailsCard, { backgroundColor: theme.cardElevated }]}>
            <T style={[s.detailsVideoTitle, { color: theme.text }]}>{title}</T>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <View style={[s.pillBadge, { backgroundColor: theme.blue }]}>
                <T style={{ color: '#fff', fontSize: 10, fontFamily: F.m }}>{resolution}</T>
              </View>
              <View style={[s.pillBadge, { backgroundColor: theme.fill }]}>
                <T style={{ color: theme.text, fontSize: 10, fontFamily: F.m }}>{format}</T>
              </View>
              {isActive && (
                <View style={[s.pillBadge, { backgroundColor: activeItem?.state === 'paused' ? theme.fill : '#30d158' }]}>
                  <T style={{ color: activeItem?.state === 'paused' ? theme.sec : '#fff', fontSize: 10, fontFamily: F.m }}>
                    {activeItem?.state === 'paused' ? 'Paused' : 'Downloading'}
                  </T>
                </View>
              )}
            </View>
          </View>

          {/* Connection & Download Metrics */}
          {isActive && (
            <View style={[s.detailsCard, { backgroundColor: theme.cardElevated, marginTop: 12 }]}>
              <T style={[s.detailsSectionTitle, { color: theme.sec }]}>CONNECTION & SPEED</T>
              <View style={s.detailsRow}>
                <T style={[s.detailsLabel, { color: theme.sec }]}>Download Speed</T>
                <T style={[s.detailsValue, { color: theme.blue, fontFamily: F.b }]}>
                  {speedText} {speedMbps ? `(${speedMbps})` : ''}
                </T>
              </View>
              <View style={s.detailsRow}>
                <T style={[s.detailsLabel, { color: theme.sec }]}>Progress</T>
                <T style={[s.detailsValue, { color: theme.text }]}>{percentText}</T>
              </View>
              <View style={s.detailsRow}>
                <T style={[s.detailsLabel, { color: theme.sec }]}>Downloaded Data</T>
                <T style={[s.detailsValue, { color: theme.text }]}>
                  {bytesDoneMb} MB ({bytesDone.toLocaleString()} bytes)
                </T>
              </View>
              <View style={s.detailsRow}>
                <T style={[s.detailsLabel, { color: theme.sec }]}>Total Estimated Size</T>
                <T style={[s.detailsValue, { color: theme.text }]}>
                  {totalBytesMb} MB ({totalBytes.toLocaleString()} bytes)
                </T>
              </View>
              <View style={s.detailsRow}>
                <T style={[s.detailsLabel, { color: theme.sec }]}>Time Remaining (ETA)</T>
                <T style={[s.detailsValue, { color: theme.text }]}>{etaText}</T>
              </View>
            </View>
          )}

          {/* Specifications */}
          <View style={[s.detailsCard, { backgroundColor: theme.cardElevated, marginTop: 12 }]}>
            <T style={[s.detailsSectionTitle, { color: theme.sec }]}>SPECIFICATIONS</T>
            <View style={s.detailsRow}>
              <T style={[s.detailsLabel, { color: theme.sec }]}>Resolution</T>
              <T style={[s.detailsValue, { color: theme.text }]}>{resolution}</T>
            </View>
            <View style={s.detailsRow}>
              <T style={[s.detailsLabel, { color: theme.sec }]}>Stream Format</T>
              <T style={[s.detailsValue, { color: theme.text }]}>
                {format} {format === 'HLS' ? '(HTTP Live Streaming)' : '(Direct Media File)'}
              </T>
            </View>
            {!isActive && (
              <View style={s.detailsRow}>
                <T style={[s.detailsLabel, { color: theme.sec }]}>File Size</T>
                <T style={[s.detailsValue, { color: theme.text }]}>{bytesDoneMb} MB</T>
              </View>
            )}
            <View style={s.detailsRow}>
              <T style={[s.detailsLabel, { color: theme.sec }]}>Storage Destination</T>
              <T style={[s.detailsValue, { color: theme.text }]}>{destinationText}</T>
            </View>
            {fileUri ? (
              <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.sep }}>
                <T style={[s.detailsLabel, { color: theme.sec, marginBottom: 2 }]}>Local Storage URI</T>
                <T numberOfLines={2} style={[s.detailsUrlText, { color: theme.sec }]}>
                  {fileUri}
                </T>
              </View>
            ) : null}
          </View>

          {/* Source Information */}
          <View style={[s.detailsCard, { backgroundColor: theme.cardElevated, marginTop: 12, marginBottom: 16 }]}>
            <T style={[s.detailsSectionTitle, { color: theme.sec }]}>SOURCE WEBSITE</T>
            <View style={s.detailsRow}>
              <T style={[s.detailsLabel, { color: theme.sec }]}>Host</T>
              <T style={[s.detailsValue, { color: theme.text }]}>{sourceHost}</T>
            </View>
            {sourcePageUrl ? (
              <View style={{ marginTop: 8 }}>
                <T style={[s.detailsLabel, { color: theme.sec, marginBottom: 4 }]}>Source URL</T>
                <T numberOfLines={2} style={[s.detailsUrlText, { color: theme.sec }]}>
                  {sourcePageUrl}
                </T>
                {onOpenSourcePage && (
                  <Pressable
                    style={[s.openSourceBtn, { backgroundColor: theme.fill }]}
                    onPress={() => {
                      onClose();
                      onOpenSourcePage(sourcePageUrl);
                    }}
                  >
                    <T style={{ color: theme.blue, fontSize: 13, fontFamily: F.m }}>Open Page in Browser</T>
                    <Ic n="ch" c={theme.blue} s={14} w={2.2} />
                  </Pressable>
                )}
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

interface DownloadsScreenProps {
  onDone: () => void;
  onOpenSourcePage: (url: string) => void;
}

export default function DownloadsScreen({ onDone, onOpenSourcePage }: DownloadsScreenProps) {
  const ok = useHanken();
  const theme = useTheme();
  const [activeList, setActiveList] = useState<ActiveDownloadItem[]>([]);
  const [savedList, setSavedList] = useState<SavedVideoItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [playingVideo, setPlayingVideo] = useState<SavedVideoItem | null>(null);
  const [selectedVideoForOptions, setSelectedVideoForOptions] = useState<SavedVideoItem | null>(null);
  const [selectedVideoForDetails, setSelectedVideoForDetails] = useState<ActiveDownloadItem | SavedVideoItem | null>(null);
  const [clearMetadataConfirmVisible, setClearMetadataConfirmVisible] = useState(false);
  const [noticeDialog, setNoticeDialog] = useState<{ visible: boolean; title: string; message: string } | null>(null);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedVideoForDetails) {
        setSelectedVideoForDetails(null);
        return true;
      }
      if (selectedVideoForOptions) {
        setSelectedVideoForOptions(null);
        return true;
      }
      if (clearMetadataConfirmVisible) {
        setClearMetadataConfirmVisible(false);
        return true;
      }
      if (noticeDialog) {
        setNoticeDialog(null);
        return true;
      }
      if (playingVideo) {
        setPlayingVideo(null);
        return true;
      }
      onDone();
      return true;
    });
    return () => sub.remove();
  }, [playingVideo, selectedVideoForOptions, selectedVideoForDetails, clearMetadataConfirmVisible, noticeDialog, onDone]);

  useEffect(() => {
    loadData();
    const unsub = DownloadManager.subscribe(() => {
      loadData();
    });
    return unsub;
  }, []);

  async function loadData() {
    const active = DownloadManager.getActiveDownloads();
    const saved = await DownloadManager.getSavedVideos();
    setActiveList(active);
    setSavedList(saved);

    // Auto-generate preview images for any saved items missing a thumbnail
    for (const item of saved) {
      if (!item.thumbnail && item.fileUri) {
        DownloadManager.generateAndSaveThumbnail(item.videoId, item.fileUri).then((thumb) => {
          if (thumb) {
            setSavedList((prev) =>
              prev.map((s) => (s.id === item.id ? { ...s, thumbnail: thumb } : s))
            );
          }
        });
      }
    }
  }

  const filteredSaved = savedList.filter((item) =>
    searchQuery ? item.title.toLowerCase().includes(searchQuery.toLowerCase()) : true
  );

  async function handleSaveToPhone(item: SavedVideoItem) {
    const res = await DownloadManager.moveToPhoneDownloads(item.fileUri, item.title);
    if (res.message && !res.message.includes('Opened save sheet')) {
      setNoticeDialog({
        visible: true,
        title: res.success ? 'Success' : 'Notice',
        message: res.message,
      });
    }
  }

  if (!ok) return null;

  const rowBorder = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.sep };

  const totalSpeedBytes = activeList
    .filter((d) => d.state === 'downloading')
    .reduce((sum, d) => sum + (d.speedBytesPerSec || 0), 0);
  const totalActiveSpeedText = DownloadManager.formatSpeed(totalSpeedBytes);

  return (
    <View style={{ flex: 1, backgroundColor: theme.grouped }}>
      <StatusBar style={theme.statusBar} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={s.top}>
          <View style={{ width: 40 }} />
          <Pressable onPress={onDone}>
            <T style={{ color: theme.blue, fontFamily: F.s, fontSize: 17 }}>Done</T>
          </Pressable>
        </View>

        <T style={[s.title, { color: theme.text }]}>Downloads</T>

        <View style={[s.search, { backgroundColor: theme.cardElevated }]}>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search videos"
            placeholderTextColor={theme.sec}
            style={{ flex: 1, color: theme.text, fontSize: 16, fontFamily: F.r }}
          />
        </View>

        {/* In progress section */}
        {activeList.length > 0 && (
          <>
            <View style={s.inProgressHeaderRow}>
              <T style={[s.hd, { color: theme.sec, marginHorizontal: 0, marginBottom: 0 }]}>In progress</T>
              <View style={[s.speedSummaryPill, { backgroundColor: theme.isDark ? 'rgba(10,132,255,0.18)' : '#e8f3ff' }]}>
                <Ic n="speed" s={12} c={theme.blue} />
                <T style={[s.speedSummaryText, { color: theme.blue }]}>{totalActiveSpeedText}</T>
              </View>
            </View>

            <View style={[s.grp, { backgroundColor: theme.card }]}>
              {activeList.map((dl) => {
                const isPaused = dl.state === 'paused';
                const isFailed = dl.state === 'failed';
                return (
                  <View key={dl.id} style={s.activeRow}>
                    <Pressable onPress={() => setSelectedVideoForDetails(dl)}>
                      <VideoThumbnailView
                        thumbnailUri={dl.thumbnail}
                        fileUri={dl.fileUri}
                        videoId={dl.videoId}
                        title={dl.title}
                        theme={theme}
                        format={dl.format || 'MP4'}
                        resolution={dl.resolution}
                      />
                    </Pressable>

                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Pressable onPress={() => setSelectedVideoForDetails(dl)}>
                        <T numberOfLines={1} style={{ fontSize: 15, fontFamily: F.s, color: theme.text, marginBottom: 2 }}>
                          {dl.title || 'Downloading video'}
                        </T>
                      </Pressable>

                      {/* Live Speed, Failure, or Connection Badges */}
                      <View style={s.activeMetricsRow}>
                        {isFailed ? (
                          <View style={[s.speedPill, { backgroundColor: 'rgba(255, 69, 58, 0.16)' }]}>
                            <T style={[s.speedPillText, { color: theme.red }]}>
                              {dl.error || 'Download failed'}
                            </T>
                          </View>
                        ) : (
                          <>
                            <View style={[s.speedPill, { backgroundColor: isPaused ? theme.fill : (theme.isDark ? 'rgba(10,132,255,0.18)' : '#e8f3ff') }]}>
                              <Ic n="speed" s={11} c={isPaused ? theme.sec : theme.blue} />
                              <T style={[s.speedPillText, { color: isPaused ? theme.sec : theme.blue }]}>
                                {isPaused ? 'Paused' : dl.speedText}
                              </T>
                            </View>
                            <T style={[s.etaText, { color: theme.sec }]}>
                              {isPaused ? 'Paused' : (dl.etaText || 'Calculating...')}
                            </T>
                          </>
                        )}
                        <View style={[s.formatBadge, { backgroundColor: theme.fill }]}>
                          <T style={{ fontSize: 9.5, fontFamily: F.m, color: theme.sec }}>
                            {dl.resolution} • {dl.format}
                          </T>
                        </View>
                      </View>

                      {/* Progress Track */}
                      <View style={[s.track, { backgroundColor: theme.cardElevated }]}>
                        <View
                          style={[
                            s.fillBar,
                            {
                              backgroundColor: isFailed ? theme.red : (isPaused ? theme.sec : theme.blue),
                              width: `${Math.min(100, Math.max(5, dl.progress * 100))}%`,
                            },
                          ]}
                        />
                      </View>

                      {/* Data Progress & Source Host */}
                      <View style={s.activeProgressBottomRow}>
                        <T style={[s.sub, { color: isFailed ? theme.red : theme.sec }]}>
                          {isFailed ? 'Download failed · Tap reload to retry' : `${dl.statusText} (${Math.round(dl.progress * 100)}%)`}
                        </T>
                        {dl.sourceHost ? (
                          <Pressable style={s.link} onPress={() => onOpenSourcePage(dl.sourcePageUrl)}>
                            <T style={{ fontSize: 11, color: theme.blue, fontFamily: F.m }}>{dl.sourceHost}</T>
                            <Ic n="ch" c={theme.blue} s={11} w={2.2} />
                          </Pressable>
                        ) : null}
                      </View>
                    </View>

                    {/* Action Controls */}
                    <View style={s.activeActionsColumn}>
                      <Pressable
                        accessibilityLabel="Video details"
                        onPress={() => setSelectedVideoForDetails(dl)}
                        style={s.actionHit}
                      >
                        <Ic n="info" c={theme.blue} s={19} />
                      </Pressable>
                      {isFailed ? (
                        <Pressable
                          accessibilityLabel="Retry download"
                          onPress={() => DownloadManager.retryDownload(dl.id)}
                          style={s.actionHit}
                        >
                          <Ic n="rl" c={theme.blue} s={19} />
                        </Pressable>
                      ) : (
                        <Pressable
                          accessibilityLabel={isPaused ? 'Resume' : 'Pause'}
                          onPress={() => {
                            if (isPaused) {
                              DownloadManager.resumeDownload(dl.id);
                            } else {
                              DownloadManager.pauseDownload(dl.id);
                            }
                          }}
                          style={s.actionHit}
                        >
                          {isPaused ? <Play s={17} c={theme.blue} /> : <Ic n="pause" c={theme.blue} s={19} />}
                        </Pressable>
                      )}
                      <Pressable
                        accessibilityLabel="Cancel download"
                        onPress={() => DownloadManager.cancelDownload(dl.id)}
                        style={s.actionHit}
                      >
                        <Ic n="x" c={theme.sec} s={16} />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Saved section */}
        <T style={[s.hd, { color: theme.sec }]}>Saved</T>
        <View style={[s.grp, { backgroundColor: theme.card }]}>
          {filteredSaved.length === 0 ? (
            <View style={[s.row, { justifyContent: 'center' }]}>
              <T style={{ color: theme.sec, fontSize: 15 }}>No saved videos yet</T>
            </View>
          ) : (
            filteredSaved.map((v, i) => (
              <View key={v.id} style={[s.row, i > 0 && rowBorder]}>
                <Pressable
                  onPress={() => setPlayingVideo(v)}
                  accessibilityLabel={`Play ${v.title}`}
                >
                  <VideoThumbnailView
                    thumbnailUri={v.thumbnail}
                    fileUri={v.fileUri}
                    videoId={v.videoId}
                    title={v.title}
                    theme={theme}
                    format={v.format || v.meta.split('·')[0].trim() || 'MP4'}
                    resolution={v.resolution || v.meta.split('·')[0].trim()}
                  />
                </Pressable>

                <Pressable
                  style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}
                  onPress={() => setPlayingVideo(v)}
                  accessibilityLabel={`Play ${v.title}`}
                >
                  <T numberOfLines={1} style={{ fontSize: 15, fontFamily: F.s, color: theme.text }}>
                    {v.title}
                  </T>
                  <T style={[s.sub, { color: theme.sec }]}>{v.meta}</T>
                  {v.sourcePageUrl ? (
                    <Pressable
                      style={s.link}
                      accessibilityLabel={`Open source page ${v.source}`}
                      onPress={() => onOpenSourcePage(v.sourcePageUrl)}
                    >
                      <T style={{ fontSize: 13, color: theme.blue, fontFamily: F.m }}>{v.source}</T>
                      <Ic n="ch" c={theme.blue} s={14} w={2.4} />
                    </Pressable>
                  ) : null}
                </Pressable>

                {/* Save to Phone Downloads Button */}
                <Pressable
                  style={s.saveRowBtn}
                  onPress={() => handleSaveToPhone(v)}
                  accessibilityLabel="Save to device downloads"
                  hitSlop={10}
                >
                  <Ic n="dl" c={theme.blue} s={20} w={2.2} />
                </Pressable>

                {/* Options ⋯ button */}
                <Pressable
                  style={{ padding: 6 }}
                  onPress={() => setSelectedVideoForOptions(v)}
                  accessibilityLabel="Options"
                >
                  <T style={{ color: theme.sec, fontSize: 18 }}>⋯</T>
                </Pressable>
              </View>
            ))
          )}
        </View>

        {filteredSaved.length > 0 && (
          <View style={[s.grp, { backgroundColor: theme.card }]}>
            <Pressable
              style={s.danger}
              onPress={() => setClearMetadataConfirmVisible(true)}
            >
              <T style={{ color: theme.red, fontFamily: F.m }}>Remove video details…</T>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Comprehensive Video Details Modal */}
      <VideoDetailsSheet
        item={selectedVideoForDetails}
        visible={!!selectedVideoForDetails}
        onClose={() => setSelectedVideoForDetails(null)}
        onOpenSourcePage={onOpenSourcePage}
      />

      {/* In-App Video Player Modal */}
      <VideoPlayerModal
        visible={!!playingVideo}
        fileUri={playingVideo?.fileUri || null}
        title={playingVideo?.title || 'Video Player'}
        meta={playingVideo?.meta}
        onClose={() => setPlayingVideo(null)}
        onSaveToPhone={() => {
          if (playingVideo) handleSaveToPhone(playingVideo);
        }}
        onShare={() => {
          if (playingVideo) DownloadManager.shareOrPlayVideo(playingVideo.fileUri);
        }}
      />

      {/* Video Options ActionSheet Modal */}
      <ActionSheetModal
        visible={!!selectedVideoForOptions}
        title="Video Options"
        message={selectedVideoForOptions?.title}
        options={[
          {
            text: 'View Video Details',
            icon: 'info',
            onPress: () => {
              if (selectedVideoForOptions) {
                const vid = selectedVideoForOptions;
                setSelectedVideoForOptions(null);
                setSelectedVideoForDetails(vid);
              }
            },
          },
          {
            text: 'Save to Phone Downloads',
            icon: 'dl',
            onPress: () => {
              if (selectedVideoForOptions) handleSaveToPhone(selectedVideoForOptions);
            },
          },
          {
            text: 'Share Video',
            icon: 'share',
            onPress: () => {
              if (selectedVideoForOptions) DownloadManager.shareOrPlayVideo(selectedVideoForOptions.fileUri);
            },
          },
          {
            text: 'Remove Details Only',
            icon: 'trash',
            onPress: async () => {
              if (selectedVideoForOptions) {
                await DownloadManager.removeVideoDetailsOnly(selectedVideoForOptions.videoId);
                loadData();
              }
            },
          },
          {
            text: 'Delete File & Details',
            icon: 'trash',
            style: 'destructive',
            onPress: async () => {
              if (selectedVideoForOptions) {
                await DownloadManager.deleteFileAndDetails(
                  selectedVideoForOptions.id,
                  selectedVideoForOptions.videoId,
                  selectedVideoForOptions.fileUri
                );
                loadData();
              }
            },
          },
        ]}
        onClose={() => setSelectedVideoForOptions(null)}
      />

      {/* Clear Video Metadata Confirmation Modal */}
      <ConfirmDialogModal
        visible={clearMetadataConfirmVisible}
        title="Clear Video Metadata"
        message="Remove all video and download records from the encrypted database? Saved files on disk will be preserved."
        confirmText="Remove All Details"
        confirmStyle="destructive"
        onConfirm={async () => {
          for (const s of savedList) {
            await DownloadManager.removeVideoDetailsOnly(s.videoId);
          }
          loadData();
        }}
        onClose={() => setClearMetadataConfirmVisible(false)}
      />

      {/* Notice / Alert Dialog Modal */}
      {noticeDialog && (
        <NoticeDialogModal
          visible={noticeDialog.visible}
          title={noticeDialog.title}
          message={noticeDialog.message}
          onClose={() => setNoticeDialog(null)}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  top: {
    paddingTop: 62,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontFamily: F.b,
    fontSize: 34,
    lineHeight: 44,
    letterSpacing: 0.3,
    marginTop: 6,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  search: {
    height: 44,
    marginHorizontal: 16,
    marginBottom: 20,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: C.fill,
    justifyContent: 'center',
  },
  inProgressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  speedSummaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  speedSummaryText: {
    fontSize: 12,
    fontFamily: F.b,
  },
  hd: {
    marginHorizontal: 32,
    marginBottom: 6,
    fontSize: 13,
    color: C.sec,
    fontFamily: F.m,
  },
  grp: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 76,
    paddingHorizontal: 12,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  activeMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 4,
    flexWrap: 'wrap',
  },
  activeProgressBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  activeActionsColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingLeft: 4,
  },
  actionHit: {
    padding: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  speedPillText: {
    fontSize: 11,
    fontFamily: F.b,
  },
  etaText: {
    fontSize: 11,
    fontFamily: F.m,
  },
  formatBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  thumb: {
    width: 88,
    height: 52,
    borderRadius: 8,
    backgroundColor: C.thumb,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  thumbOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbResolutionBadge: {
    position: 'absolute',
    top: 3,
    left: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  thumbResolutionText: {
    fontSize: 8,
    fontFamily: F.b,
    color: '#ffffff',
  },
  playBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  posterContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  posterBadgeText: {
    fontSize: 9,
    fontFamily: F.b,
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  sub: {
    fontSize: 12,
    color: C.sec,
  },
  track: {
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#e5e5ea',
    marginTop: 4,
    marginBottom: 4,
  },
  fillBar: {
    height: 5,
    borderRadius: 2.5,
    backgroundColor: C.blue,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  danger: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveRowBtn: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    alignSelf: 'center',
    marginBottom: 12,
  },
  detailsModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    justifyContent: 'flex-end',
  },
  detailsModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  detailsModalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'android' ? 72 : 36,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 20,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  detailsHeaderTitle: {
    fontSize: 18,
    fontFamily: F.b,
  },
  detailsCloseBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  detailsCard: {
    borderRadius: 12,
    padding: 12,
  },
  detailsVideoTitle: {
    fontSize: 15,
    fontFamily: F.s,
    lineHeight: 20,
  },
  detailsSectionTitle: {
    fontSize: 11,
    fontFamily: F.b,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  detailsLabel: {
    fontSize: 13,
    fontFamily: F.r,
  },
  detailsValue: {
    fontSize: 13,
    fontFamily: F.m,
    maxWidth: '55%',
    textAlign: 'right',
  },
  detailsUrlText: {
    fontSize: 12,
    fontFamily: F.r,
    lineHeight: 16,
  },
  openSourceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
    gap: 4,
  },
  pillBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
});


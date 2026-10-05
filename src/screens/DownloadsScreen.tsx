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
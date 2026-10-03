import React, { useEffect } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  BackHandler,
  Image,
  ImageBackground,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { F, Ic, T, useHanken, useTheme, AppleTheme } from '../theme/tokens';
import { useBrowserStore, BrowserTab, SearchEngine } from '../browser/browserStore';
import SearchEngineIcon from '../components/SearchEngineIcon';

interface TabsScreenProps {
  onDone: () => void;
  onOpenSettings: () => void;
  onOpenDownloads: () => void;
}

function getSearchEngineFromUrl(url?: string): SearchEngine | null {
  if (!url) return null;
  const lower = url.toLowerCase();
  if (lower.includes('google.com')) return 'Google';
  if (lower.includes('duckduckgo.com')) return 'DuckDuckGo';
  if (lower.includes('search.brave.com') || lower.includes('brave.com')) return 'Brave';
  if (lower.includes('bing.com')) return 'Bing';
  if (lower.includes('ecosia.org')) return 'Ecosia';
  return null;
}

function getSearchQuery(url?: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    const q = parsed.searchParams.get('q') || parsed.searchParams.get('query') || parsed.searchParams.get('p');
    if (q) return decodeURIComponent(q.replace(/\+/g, ' '));
  } catch {
    const match = url.match(/[?&](?:q|query|p)=([^&]+)/i);
    if (match && match[1]) {
      try {
        return decodeURIComponent(match[1].replace(/\+/g, ' '));
      } catch {
        return match[1];
      }
    }
  }
  return '';
}

function getDomain(url?: string): string {
  if (!url || url === 'about:blank') return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    const match = url.match(/https?:\/\/(?:www\.)?([^\/\?#]+)/i);
    return match ? match[1] : '';
  }
}

function renderBlankTabPreview(theme: AppleTheme, engine: SearchEngine) {
  return (
    <ImageBackground
      source={require('../../assets/home-bg-2.png')}
      style={s.previewFill}
      resizeMode="cover"
    >
      <View style={s.blankPreviewOverlay}>
        <View style={s.miniBrandBadge}>
          <Ic n="sh" c="#ffffff" s={13} w={2} />
          <T style={s.miniBrandText}>Breeze</T>
        </View>

        <View
          style={[
            s.miniSearchBar,
            {
              backgroundColor: theme.isDark ? '#202124' : '#ffffff',
              borderColor: theme.isDark ? '#3c4043' : 'rgba(0,0,0,0.08)',
            },
          ]}
        >
          <SearchEngineIcon engine={engine} size={12} />
          <T numberOfLines={1} style={[s.miniSearchPlaceholder, { color: theme.isDark ? '#9aa0a6' : '#5f6368' }]}>
            Search or type URL
          </T>
          <Ic n="search" c={theme.isDark ? '#9aa0a6' : '#5f6368'} s={10} w={2} />
        </View>

        <View style={s.miniShortcutsRow}>
          <View style={s.miniShortcutItem}>
            <View style={[s.miniShortcutCircle, { backgroundColor: '#ffffff' }]}>
              <SearchEngineIcon engine="Google" size={11} />
            </View>
            <T style={s.miniShortcutLabel}>Google</T>
          </View>

          <View style={s.miniShortcutItem}>
            <View style={[s.miniShortcutCircle, { backgroundColor: '#ff0000' }]}>
              <T style={{ color: '#fff', fontSize: 7, fontFamily: F.b }}>▶</T>
            </View>
            <T style={s.miniShortcutLabel}>YouTube</T>
          </View>

          <View style={s.miniShortcutItem}>
            <View style={[s.miniShortcutCircle, { backgroundColor: '#ffffff' }]}>
              <T style={{ color: '#000', fontSize: 8, fontFamily: F.b }}>W</T>
            </View>
            <T style={s.miniShortcutLabel}>Wiki</T>
          </View>

          <View style={s.miniShortcutItem}>
            <View style={[s.miniShortcutCircle, { backgroundColor: '#ff4500' }]}>
              <T style={{ color: '#fff', fontSize: 8, fontFamily: F.b }}>r/</T>
            </View>
            <T style={s.miniShortcutLabel}>Reddit</T>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

function renderSearchEnginePreview(
  url: string,
  engine: SearchEngine,
  title: string,
  theme: AppleTheme
) {
  const query = getSearchQuery(url);
  const isDark = theme.isDark;
  const bg = isDark ? '#202124' : '#ffffff';
  const cardBg = isDark ? '#303134' : '#f8f9fa';
  const linkColor = isDark ? '#8ab4f8' : '#1a0dab';
  const snippetColor = isDark ? '#bdc1c6' : '#4d5156';
  const metaColor = isDark ? '#9aa0a6' : '#70757a';
  const borderCol = isDark ? '#3c4043' : '#dadce0';

  if (!query) {
    return (
      <View style={[s.previewFill, { backgroundColor: bg, alignItems: 'center', justifyContent: 'center', padding: 12 }]}>
        <SearchEngineIcon engine={engine} size={30} />
        <T style={{ fontSize: 12, fontFamily: F.m, color: theme.text, marginTop: 6 }}>
          {engine}
        </T>
        <View style={[s.miniSearchBar, { backgroundColor: cardBg, borderColor: borderCol, marginTop: 10, width: '100%' }]}>
          <Ic n="search" c={metaColor} s={10} w={2} />
          <T style={[s.miniSearchPlaceholder, { color: metaColor }]}>Search the web</T>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
          <View style={{ paddingHorizontal: 6, paddingVertical: 2.5, borderRadius: 4, backgroundColor: isDark ? '#3c4043' : '#f1f3f4' }}>
            <T style={{ fontSize: 7.5, color: theme.text }}>Search</T>
          </View>
          <View style={{ paddingHorizontal: 6, paddingVertical: 2.5, borderRadius: 4, backgroundColor: isDark ? '#3c4043' : '#f1f3f4' }}>
            <T style={{ fontSize: 7.5, color: theme.text }}>Trending</T>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.previewFill, { backgroundColor: bg, padding: 8 }]}>
      <View style={[s.miniSearchBar, { backgroundColor: cardBg, borderColor: borderCol, marginBottom: 6 }]}>
        <SearchEngineIcon engine={engine} size={11} />
        <T numberOfLines={1} style={{ fontSize: 8.5, fontFamily: F.m, color: theme.text, marginLeft: 4, flex: 1 }}>
          {query}
        </T>
        <Ic n="search" c={metaColor} s={9} w={2} />
      </View>

      <View style={{ flexDirection: 'row', gap: 4, marginBottom: 7, paddingBottom: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderCol }}>
        <View style={{ paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6, backgroundColor: theme.blue }}>
          <T style={{ fontSize: 7, fontFamily: F.m, color: '#ffffff' }}>All</T>
        </View>
        <View style={{ paddingHorizontal: 4, paddingVertical: 1 }}>
          <T style={{ fontSize: 7, fontFamily: F.r, color: metaColor }}>Images</T>
        </View>
        <View style={{ paddingHorizontal: 4, paddingVertical: 1 }}>
          <T style={{ fontSize: 7, fontFamily: F.r, color: metaColor }}>News</T>
        </View>
        <View style={{ paddingHorizontal: 4, paddingVertical: 1 }}>
          <T style={{ fontSize: 7, fontFamily: F.r, color: metaColor }}>Videos</T>
        </View>
      </View>

      <View style={{ marginBottom: 7 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
          <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: theme.blue, marginRight: 3 }} />
          <T numberOfLines={1} style={{ fontSize: 6.5, fontFamily: F.r, color: metaColor }}>
            {query.split(' ')[0]}.org &gt; overview
          </T>
        </View>
        <T numberOfLines={1} style={{ fontSize: 9, fontFamily: F.m, color: linkColor, marginBottom: 1.5 }}>
          {title && !title.includes('Google') && !title.includes('Search') ? title : `${query} - Latest Guide & Overview`}
        </T>
        <T numberOfLines={2} style={{ fontSize: 7, fontFamily: F.r, color: snippetColor, lineHeight: 9.5 }}>
          Comprehensive information, top articles, and up-to-date facts about {query}...
        </T>
      </View>

      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
          <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: isDark ? '#81c995' : '#188038', marginRight: 3 }} />
          <T numberOfLines={1} style={{ fontSize: 6.5, fontFamily: F.r, color: metaColor }}>
            wikipedia.org &gt; wiki &gt; {query.replace(/\s+/g, '_')}
          </T>
        </View>
        <T numberOfLines={1} style={{ fontSize: 9, fontFamily: F.m, color: linkColor, marginBottom: 1.5 }}>
          {query} - Wikipedia
        </T>
        <T numberOfLines={2} style={{ fontSize: 7, fontFamily: F.r, color: snippetColor, lineHeight: 9.5 }}>
          Read the open encyclopedia entry, history, and references regarding {query}...
        </T>
      </View>
    </View>
  );
}

function renderWebPreviewWithImage(
  t: BrowserTab,
  domain: string,
  theme: AppleTheme
) {
  return (
    <View style={[s.previewFill, { backgroundColor: theme.card }]}>
      <View style={[s.miniSiteBar, { backgroundColor: theme.isDark ? '#2c2c2e' : '#f2f2f7', borderBottomColor: theme.sep }]}>
        <Ic n="lock" c={theme.sec} s={8} w={2} />
        <T numberOfLines={1} style={{ fontSize: 8, fontFamily: F.m, color: theme.sec, marginLeft: 3, flex: 1 }}>
          {domain}
        </T>
      </View>

      <View style={{ width: '100%', height: 92, backgroundColor: theme.isDark ? '#232326' : '#e5e5ea', overflow: 'hidden' }}>
        <Image
          source={{ uri: t.previewImage }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      </View>

      <View style={{ padding: 7, flex: 1 }}>
        <T numberOfLines={2} style={{ fontSize: 9.5, fontFamily: F.s, color: theme.text, lineHeight: 12, marginBottom: 3 }}>
          {t.title || domain}
        </T>
        <T numberOfLines={3} style={{ fontSize: 7.5, fontFamily: F.r, color: theme.sec, lineHeight: 10 }}>
          {t.description || `Explore detailed contents, articles, and interactive features on ${domain}.`}
        </T>

        <View style={{ marginTop: 'auto', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, backgroundColor: theme.fill }}>
            <T style={{ fontSize: 6.5, fontFamily: F.m, color: theme.sec }}>Web Article</T>
          </View>
          <T style={{ fontSize: 6.5, color: theme.tertiary }}>HTTPS</T>
        </View>
      </View>
    </View>
  );
}

function renderWebDocumentPreview(
  t: BrowserTab,
  domain: string,
  theme: AppleTheme
) {
  const initial = (domain.charAt(0) || t.title.charAt(0) || 'W').toUpperCase();
  const isDark = theme.isDark;

  return (
    <View style={[s.previewFill, { backgroundColor: theme.card }]}>
      <View style={[s.miniSiteBar, { backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7', borderBottomColor: theme.sep }]}>
        <Ic n="lock" c={theme.sec} s={8} w={2} />
        <T numberOfLines={1} style={{ fontSize: 8, fontFamily: F.m, color: theme.sec, marginLeft: 3, flex: 1 }}>
          {domain}
        </T>
        <T style={{ fontSize: 8, color: theme.tertiary, letterSpacing: 1 }}>•••</T>
      </View>

      <View style={{ flex: 1, padding: 7 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
          <View style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: theme.blue, alignItems: 'center', justifyContent: 'center', marginRight: 4 }}>
            <T style={{ color: '#fff', fontSize: 9, fontFamily: F.s }}>{initial}</T>
          </View>
          <View style={{ flex: 1 }}>
            <T numberOfLines={1} style={{ fontSize: 8.5, fontFamily: F.m, color: theme.text }}>
              {domain}
            </T>
          </View>
        </View>

        <T numberOfLines={2} style={{ fontSize: 9.5, fontFamily: F.s, color: theme.text, lineHeight: 13, marginBottom: 4 }}>
          {t.title || domain}
        </T>

        {t.description ? (
          <T numberOfLines={3} style={{ fontSize: 7.5, fontFamily: F.r, color: theme.sec, lineHeight: 10, marginBottom: 5 }}>
            {t.description}
          </T>
        ) : null}

        <View style={{ gap: 3.5, marginBottom: 5 }}>
          <View style={[s.mockTextLine, { width: '100%', backgroundColor: isDark ? '#3a3a3c' : '#e5e5ea' }]} />
          <View style={[s.mockTextLine, { width: '92%', backgroundColor: isDark ? '#3a3a3c' : '#e5e5ea' }]} />
          <View style={[s.mockTextLine, { width: '78%', backgroundColor: isDark ? '#3a3a3c' : '#e5e5ea' }]} />
        </View>

        <View style={{ borderLeftWidth: 2, borderLeftColor: theme.blue, paddingLeft: 5, paddingVertical: 1.5, marginVertical: 3, backgroundColor: isDark ? '#242426' : '#f8f8fc', borderRadius: 2 }}>
          <View style={[s.mockTextLine, { width: '85%', height: 4, backgroundColor: isDark ? '#48484a' : '#d1d1d6' }]} />
          <View style={[s.mockTextLine, { width: '55%', height: 4, marginTop: 2.5, backgroundColor: isDark ? '#48484a' : '#d1d1d6' }]} />
        </View>

        <View style={{ gap: 3.5, marginTop: 3 }}>
          <View style={[s.mockTextLine, { width: '95%', backgroundColor: isDark ? '#3a3a3c' : '#e5e5ea' }]} />
          <View style={[s.mockTextLine, { width: '68%', backgroundColor: isDark ? '#3a3a3c' : '#e5e5ea' }]} />
        </View>
      </View>
    </View>
  );
}

function renderTabPreview(t: BrowserTab, theme: AppleTheme, currentEngine: SearchEngine) {
  if (t.isBlank || !t.url || t.url === 'about:blank') {
    return renderBlankTabPreview(theme, currentEngine);
  }

  const searchEngine = getSearchEngineFromUrl(t.url);
  if (searchEngine) {
    return renderSearchEnginePreview(t.url, searchEngine, t.title, theme);
  }

  const domain = getDomain(t.url);
  if (t.previewImage) {
    return renderWebPreviewWithImage(t, domain, theme);
  }

  return renderWebDocumentPreview(t, domain, theme);
}

export default function TabsScreen({ onDone, onOpenSettings, onOpenDownloads }: TabsScreenProps) {
  const ok = useHanken();
  const theme = useTheme();
  const { tabs, activeTabId, createTab, closeTab, setActiveTab, searchEngine } = useBrowserStore();

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onDone();
      return true;
    });
    return () => sub.remove();
  }, [onDone]);

  function handleSelectTab(t: BrowserTab) {
    setActiveTab(t.id);
    onDone();
  }

  function handleNewTab() {
    createTab();
    onDone();
  }

  if (!ok) return null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.grouped }}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={s.grid}>
          {tabs.map((t) => {
            const isActive = t.id === activeTabId;
            const domain = getDomain(t.url);
            const tabEngine = getSearchEngineFromUrl(t.url);
            const isBlankTab = t.isBlank || !t.url || t.url === 'about:blank';
            const displayTitle = isBlankTab
              ? 'New Tab'
              : (t.title && t.title !== 'about:blank' ? t.title : (domain || 'Web Page'));

            return (
              <Pressable
                key={t.id}
                style={[
                  s.card,
                  {
                    backgroundColor: theme.card,
                    borderColor: isActive ? theme.blue : (theme.isDark ? '#3a3a3c' : 'rgba(60,60,67,0.18)'),
                  },
                ]}
                onPress={() => handleSelectTab(t)}
              >
                <View style={[s.cardHead, { backgroundColor: theme.isDark ? '#2c2c2e' : '#e5e5ea', borderBottomColor: theme.sep, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 6 }}>
                    {isBlankTab ? (
                      <View style={{ marginRight: 5 }}>
                        <Ic n="plus" c={theme.sec} s={12} w={2.2} />
                      </View>
                    ) : tabEngine ? (
                      <View style={{ marginRight: 5 }}>
                        <SearchEngineIcon engine={tabEngine} size={13} />
                      </View>
                    ) : (
                      <View style={{ marginRight: 5 }}>
                        <Ic n="lock" c={theme.sec} s={11} w={2} />
                      </View>
                    )}
                    <T numberOfLines={1} style={{ fontSize: 12, fontFamily: F.m, flex: 1, color: theme.text }}>
                      {displayTitle}
                    </T>
                  </View>
                  <Pressable
                    hitSlop={8}
                    onPress={(e) => {
                      e.stopPropagation();
                      closeTab(t.id);
                    }}
                    style={{ paddingLeft: 6 }}
                  >
                    <T style={{ fontSize: 18, color: theme.sec, fontFamily: F.m, lineHeight: 20 }}>×</T>
                  </Pressable>
                </View>

                <View style={s.cardBody}>
                  {renderTabPreview(t, theme, searchEngine)}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom Control Bar */}
      <View style={[s.bottom, { backgroundColor: theme.card, borderTopColor: theme.sep }]}>
        <Pressable accessibilityLabel="New tab" style={s.hit} onPress={handleNewTab}>
          <Ic n="plus" c={theme.blue} s={24} />
        </Pressable>
        <Pressable accessibilityLabel="Settings" style={s.hit} onPress={onOpenSettings}>
          <Ic n="gear" c={theme.blue} s={22} />
        </Pressable>
        <View style={s.hit}>
          <T style={{ color: theme.text, fontSize: 15, fontFamily: F.s }}>
            {tabs.length} {tabs.length === 1 ? 'Tab' : 'Tabs'}
          </T>
        </View>
        <Pressable accessibilityLabel="Downloads" style={s.hit} onPress={onOpenDownloads}>
          <Ic n="dl" c={theme.blue} s={22} />
        </Pressable>
        <Pressable style={s.hit} onPress={onDone}>
          <T style={{ color: theme.blue, fontFamily: F.s, fontSize: 16 }}>Done</T>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  scrollContent: {
    paddingTop: 68,
    paddingBottom: 140,
    alignItems: 'center',
  },
  grid: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
  },
  card: {
    width: 167,
    height: 236,
    borderRadius: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardHead: {
    height: 34,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardBody: {
    flex: 1,
    overflow: 'hidden',
  },
  previewFill: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  blankPreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  miniBrandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 4,
  },
  miniBrandText: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: F.s,
    letterSpacing: 0.5,
  },
  miniSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    width: '100%',
  },
  miniSearchPlaceholder: {
    fontSize: 8.5,
    fontFamily: F.r,
    marginLeft: 5,
    flex: 1,
  },
  miniShortcutsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  miniShortcutItem: {
    alignItems: 'center',
  },
  miniShortcutCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  miniShortcutLabel: {
    fontSize: 6.5,
    fontFamily: F.m,
    color: 'rgba(255,255,255,0.9)',
  },
  miniSiteBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mockTextLine: {
    height: 4.5,
    borderRadius: 2,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 48,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  hit: {
    height: 44,
    justifyContent: 'center',
  },
});


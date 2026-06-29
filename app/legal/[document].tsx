import Colors from "@/constants/Colors";
import { FontAwesome6 } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  isLegalDocumentId,
  LEGAL_DOCUMENTS,
} from "../../data/legalDocuments";
import { useAppTheme } from "../../contexts/ThemeContext";

export default function LegalDocumentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ document?: string | string[] }>();
  const { palette } = useAppTheme();
  const document = isLegalDocumentId(params.document)
    ? LEGAL_DOCUMENTS[params.document]
    : null;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: palette.background }]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Hukuki metinden geri dön"
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <FontAwesome6 name="arrow-left" size={18} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.text }]}>
          {document?.title || "Hukuki Metin"}
        </Text>
        <View style={styles.backButton} />
      </View>

      {document ? (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.versionCard,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <FontAwesome6
              name="file-shield"
              size={18}
              color={Colors.orange}
            />
            <View style={styles.versionText}>
              <Text style={[styles.versionTitle, { color: palette.text }]}>
                Sürüm {document.version}
              </Text>
              <Text style={[styles.updatedAt, { color: palette.muted }]}>
                Son güncelleme: {document.updatedAt}
              </Text>
            </View>
          </View>

          {document.introduction.map((paragraph) => (
            <Text
              key={paragraph}
              style={[styles.introduction, { color: palette.softText }]}
            >
              {paragraph}
            </Text>
          ))}

          {document.sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                {section.title}
              </Text>
              {section.paragraphs?.map((paragraph) => (
                <Text
                  key={paragraph}
                  style={[styles.paragraph, { color: palette.softText }]}
                >
                  {paragraph}
                </Text>
              ))}
              {section.bullets?.map((bullet) => (
                <View key={bullet} style={styles.bulletRow}>
                  <View style={styles.bullet} />
                  <Text
                    style={[styles.bulletText, { color: palette.softText }]}
                  >
                    {bullet}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.notFound}>
          <FontAwesome6
            name="file-circle-xmark"
            size={36}
            color={palette.muted}
          />
          <Text style={[styles.notFoundTitle, { color: palette.text }]}>
            Metin bulunamadı
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 58,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "800",
  },
  content: { padding: 20, paddingBottom: 48 },
  versionCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
  },
  versionText: { marginLeft: 12 },
  versionTitle: { fontSize: 14, fontWeight: "800" },
  updatedAt: { fontSize: 12, marginTop: 3 },
  introduction: { fontSize: 14, lineHeight: 22, marginBottom: 18 },
  section: { marginBottom: 22 },
  sectionTitle: { fontSize: 17, fontWeight: "900", marginBottom: 9 },
  paragraph: { fontSize: 14, lineHeight: 22 },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.orange,
    marginTop: 8,
    marginRight: 10,
  },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 21 },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  notFoundTitle: { fontSize: 18, fontWeight: "800" },
});

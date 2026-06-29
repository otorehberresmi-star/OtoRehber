import Colors from "@/constants/Colors";
import { FontAwesome6 } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../contexts/ThemeContext";
import {
  getCatalogBrands,
  getCatalogEngines,
  getCatalogModels,
  getCatalogVariants,
  normalizeCatalogText,
  VehicleCatalogSelection,
} from "../utils/vehicleCatalog";

type Step = "brand" | "model" | "engine" | "variant";
export type VehicleCatalogLevelSelection = {
  level: "model" | "engine";
  brand: string;
  model: string;
  engineGroup?: string;
  fuelType?: string;
};
type PickerOption = {
  key: string;
  label: string;
  subtitle?: string;
  selection?: VehicleCatalogSelection;
  disabled?: boolean;
};

export default function VehicleCatalogPicker({
  visible,
  onClose,
  onSelect,
  title = "Araç Seç",
  disabledModel,
  allowCurrentLevelSelect = false,
  onSelectCurrentLevel,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (selection: VehicleCatalogSelection) => void;
  title?: string;
  disabledModel?: { brand: string; model: string } | null;
  allowCurrentLevelSelect?: boolean;
  onSelectCurrentLevel?: (selection: VehicleCatalogLevelSelection) => void;
}) {
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>("brand");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [engine, setEngine] = useState("");
  const [search, setSearch] = useState("");

  const reset = () => {
    setStep("brand");
    setBrand("");
    setModel("");
    setEngine("");
    setSearch("");
  };

  const close = () => {
    reset();
    onClose();
  };

  const goBack = () => {
    setSearch("");
    if (step === "variant") {
      setStep("engine");
      setEngine("");
    } else if (step === "engine") {
      setStep("model");
      setModel("");
    } else if (step === "model") {
      setStep("brand");
      setBrand("");
    } else {
      close();
    }
  };

  const options = useMemo<PickerOption[]>(() => {
    if (step === "brand") {
      return getCatalogBrands().map((label) => ({ key: label, label }));
    }
    if (step === "model") {
      return getCatalogModels(brand).map((label) => ({
        key: label,
        label,
        disabled: Boolean(
          disabledModel &&
            normalizeCatalogText(disabledModel.brand) ===
              normalizeCatalogText(brand) &&
            normalizeCatalogText(disabledModel.model) ===
              normalizeCatalogText(label),
        ),
      }));
    }
    if (step === "engine") {
      return getCatalogEngines(brand, model).map((label) => ({
        key: label,
        label,
      }));
    }
    return getCatalogVariants(brand, model, engine).map((item) => ({
      key: [
        item.sourceRecordId,
        item.brand,
        item.model,
        item.engineGroup,
        item.trim,
      ].join("|"),
      label: item.trim,
      subtitle: `${item.transmission} · ${item.fuelType}`,
      selection: item,
    }));
  }, [brand, disabledModel, engine, model, step]);

  const filteredOptions = useMemo(() => {
    const query = normalizeCatalogText(search);
    if (!query) return options;
    return options.filter((item) =>
      normalizeCatalogText(`${item.label} ${item.subtitle || ""}`).includes(
        query,
      ),
    );
  }, [options, search]);

  const stepTitle =
    step === "brand"
      ? "Marka Seç"
      : step === "model"
        ? "Model Seç"
        : step === "engine"
          ? "Motor ve Yakıt Seç"
          : "Donanım Seç";

  const path = [brand, model, engine].filter(Boolean).join("  ›  ");
  const canSelectCurrentLevel =
    allowCurrentLevelSelect &&
    Boolean(onSelectCurrentLevel) &&
    Boolean(brand && model) &&
    (step === "engine" || step === "variant");

  const currentLevelLabel =
    step === "variant" && engine
      ? "Seçilen motor seviyesinde kıyaslamaya ekle"
      : "Seçilen model seviyesinde kıyaslamaya ekle";

  const selectCurrentLevel = () => {
    if (!onSelectCurrentLevel || !brand || !model) return;

    if (step === "variant" && engine) {
      const firstVariant = getCatalogVariants(brand, model, engine)[0];
      onSelectCurrentLevel({
        level: "engine",
        brand,
        model,
        engineGroup: firstVariant?.engineGroup || engine.split("·")[0]?.trim(),
        fuelType: firstVariant?.fuelType || engine.split("·")[1]?.trim(),
      });
      close();
      return;
    }

    onSelectCurrentLevel({
      level: "model",
      brand,
      model,
    });
    close();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={goBack}
    >
      <Pressable style={styles.overlay} onPress={close} />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: palette.background,
            borderColor: palette.border,
            paddingBottom: Math.max(insets.bottom, 18),
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: palette.border }]} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={goBack}>
            <FontAwesome6
              name={step === "brand" ? "xmark" : "arrow-left"}
              size={17}
              color={palette.text}
            />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={[styles.eyebrow, { color: Colors.orange }]}>{title}</Text>
            <Text style={[styles.title, { color: palette.text }]}>{stepTitle}</Text>
            {!!path && (
              <Text
                style={[styles.path, { color: palette.muted }]}
                numberOfLines={1}
              >
                {path}
              </Text>
            )}
          </View>
          <View style={styles.iconBtn} />
        </View>

        <View
          style={[
            styles.searchBox,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <FontAwesome6 name="magnifying-glass" size={14} color={palette.muted} />
          <TextInput
            style={[styles.searchInput, { color: palette.text }]}
            value={search}
            onChangeText={setSearch}
            placeholder={`${stepTitle.replace(" Seç", "")} ara...`}
            placeholderTextColor={palette.muted}
            autoCorrect={false}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
              <FontAwesome6 name="xmark" size={14} color={palette.muted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <FlatList
          data={filteredOptions}
          keyExtractor={(item) => item.key}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: palette.muted }]}>
              Sonuç bulunamadı.
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.item,
                { borderBottomColor: palette.border },
                item.disabled && styles.itemDisabled,
              ]}
              activeOpacity={0.8}
              disabled={item.disabled}
              onPress={() => {
                setSearch("");
                if (step === "brand") {
                  setBrand(item.label);
                  setStep("model");
                } else if (step === "model") {
                  setModel(item.label);
                  setStep("engine");
                } else if (step === "engine") {
                  setEngine(item.label);
                  setStep("variant");
                } else if (item.selection) {
                  onSelect(item.selection);
                  close();
                }
              }}
            >
              <View style={styles.itemIcon}>
                <FontAwesome6
                  name={
                    step === "brand"
                      ? "copyright"
                      : step === "model"
                        ? "car-side"
                        : step === "engine"
                          ? "gears"
                          : "list-check"
                  }
                  size={14}
                  color={Colors.orange}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemLabel, { color: palette.text }]}>
                  {item.label}
                </Text>
                {item.disabled ? (
                  <Text style={[styles.itemSubtitle, { color: palette.muted }]}>
                    Diğer karşılaştırma alanında seçili
                  </Text>
                ) : null}
                {!!item.subtitle && (
                  <Text style={[styles.itemSubtitle, { color: palette.muted }]}>
                    {item.subtitle}
                  </Text>
                )}
              </View>
              <FontAwesome6
                name={
                  item.disabled
                    ? "ban"
                    : step === "variant"
                      ? "check"
                      : "chevron-right"
                }
                size={13}
                color={
                  item.disabled
                    ? palette.muted
                    : step === "variant"
                      ? Colors.orange
                      : palette.muted
                }
              />
            </TouchableOpacity>
          )}
        />
        {canSelectCurrentLevel ? (
          <View style={[styles.footer, { borderTopColor: palette.border }]}>
            <TouchableOpacity
              style={styles.currentLevelBtn}
              onPress={selectCurrentLevel}
              activeOpacity={0.85}
            >
              <FontAwesome6 name="list" size={14} color={Colors.white} />
              <Text style={styles.currentLevelText}>{currentLevelLabel}</Text>
            </TouchableOpacity>
            <Text style={[styles.currentLevelHint, { color: palette.muted }]}>
              Daha fazla ayrıntı seçmeden bu seviyeyi kullan
            </Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "84%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    overflow: "hidden",
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, alignItems: "center" },
  eyebrow: { fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  title: { fontSize: 18, fontWeight: "900", marginTop: 2 },
  path: { fontSize: 11, fontWeight: "600", marginTop: 3, maxWidth: "100%" },
  searchBox: {
    marginHorizontal: 18,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 10 },
  list: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 30 },
  item: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemDisabled: {
    opacity: 0.45,
  },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(249,115,22,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  itemLabel: { fontSize: 14, fontWeight: "800" },
  itemSubtitle: { fontSize: 11, fontWeight: "600", marginTop: 3 },
  emptyText: { textAlign: "center", paddingVertical: 40, fontSize: 13 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingTop: 12,
    gap: 7,
  },
  currentLevelBtn: {
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
  },
  currentLevelText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  currentLevelHint: {
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
});

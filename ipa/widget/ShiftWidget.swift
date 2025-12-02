import WidgetKit
import SwiftUI

struct SharedData: Decodable {
    let shiftName: String
    let shiftColorHex: String
    let dateString: String
    let lunarDate: String
    let note: String
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let data: SharedData
}

struct Provider: TimelineProvider {
    // [QUAN TRỌNG] Cái này phải trùng khớp với App Group trong Plugin
    let appGroupKey = "group.com.ghichu.widgetdata" 
    
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), data: SharedData(shiftName: "CA NGÀY", shiftColorHex: "#F59E0B", dateString: "01/01", lunarDate: "15/11 AL", note: "Ví dụ ghi chú..."))
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        completion(SimpleEntry(date: Date(), data: SharedData(shiftName: "CA NGÀY", shiftColorHex: "#F59E0B", dateString: "01/01", lunarDate: "15/11 AL", note: "Ví dụ ghi chú...")))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        let userDefaults = UserDefaults(suiteName: appGroupKey)
        let entryData: SharedData
        
        if let jsonString = userDefaults?.string(forKey: "widgetData"),
           let jsonData = jsonString.data(using: .utf8),
           let decoded = try? JSONDecoder().decode(SharedData.self, from: jsonData) {
            entryData = decoded
        } else {
            entryData = SharedData(shiftName: "CHƯA CÓ", shiftColorHex: "#9CA3AF", dateString: "--/--", lunarDate: "--", note: "Vào app để cập nhật")
        }

        let entry = SimpleEntry(date: Date(), data: entryData)
        // Refresh mỗi 15 phút
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

struct ShiftWidgetEntryView : View {
    var entry: Provider.Entry
    
    func colorFromHex(_ hex: String) -> Color {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "#", with: "")
        var rgb: UInt64 = 0
        Scanner(string: hexSanitized).scanHexInt64(&rgb)
        let r = Double((rgb & 0xFF0000) >> 16) / 255.0
        let g = Double((rgb & 0x00FF00) >> 8) / 255.0
        let b = Double(rgb & 0x0000FF) / 255.0
        return Color(red: r, green: g, blue: b)
    }

    var body: some View {
        GeometryReader { geo in
            ZStack {
                Color("WidgetBackground")
                VStack(alignment: .leading, spacing: 0) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(entry.data.shiftName).font(.system(size: 16, weight: .heavy)).foregroundColor(colorFromHex(entry.data.shiftColorHex))
                            Text(entry.data.dateString).font(.system(size: 10, weight: .medium)).foregroundColor(.gray)
                        }
                        Spacer()
                        Text(entry.data.lunarDate).font(.system(size: 10, weight: .bold))
                            .padding(.horizontal, 6).padding(.vertical, 3)
                            .background(Color.gray.opacity(0.15)).cornerRadius(5).foregroundColor(.primary)
                    }.padding(.bottom, 8)
                    Divider().padding(.bottom, 8)
                    if entry.data.note.isEmpty {
                        Text("Không có ghi chú").font(.system(size: 12)).italic().foregroundColor(.gray.opacity(0.5))
                    } else {
                        Text(entry.data.note).font(.system(size: 12)).lineLimit(3)
                    }
                    Spacer()
                }.padding(14)
            }
        }
    }
}

@main
struct ShiftWidget: Widget {
    let kind: String = "ShiftWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            ShiftWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Lịch Ca")
        .description("Xem ca làm việc và ghi chú.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
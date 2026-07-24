# K3 — Ngày 1: Bài Tập & Phản Ánh
## Khám Phá LLM API | Phiếu Thực Hành

**Thời lượng:** 9h00–13h00
**Cách làm:** Trả lời từng câu ngay sau khi hoàn thành block tương ứng —
đừng để dồn hết về cuối buổi. Thay dòng placeholder trong mỗi câu bằng câu
trả lời thật (chấm tự động sẽ đếm số câu đã trả lời).

---

## Block 1 — API Cơ Bản (trả lời sau Checkpoint 1)

### Câu 1.1 — Độ nhạy của temperature
Gọi `call_openai` với temperature 0.0, 0.5, 1.0 và 1.5 dùng prompt
**"Hãy kể cho tôi một sự thật thú vị về Việt Nam."**

**Bạn nhận thấy quy luật gì qua bốn phản hồi?** (2–3 câu)
> Khi temperature tăng từ 0.0 lên 1.5, câu trả lời thường bớt ổn định hơn và có xu hướng đa dạng, giàu chi tiết hoặc cách diễn đạt sáng tạo hơn. Ở 0.0 phản hồi thường ngắn gọn, an toàn và lặp quy luật rõ hơn; ở 1.0–1.5 model dễ thêm các chi tiết thú vị hơn nhưng cũng có thể lan man hoặc ít nhất quán hơn.

### Câu 1.2 — Chọn temperature cho sản phẩm
**Bạn sẽ đặt temperature bao nhiêu cho chatbot hỗ trợ khách hàng, và tại sao?**
> Mình sẽ đặt khoảng 0.2–0.4 cho chatbot hỗ trợ khách hàng vì mục tiêu chính là trả lời ổn định, dễ kiểm soát và ít tự bịa. Mức này vẫn đủ tự nhiên trong diễn đạt nhưng giảm rủi ro mỗi lần trả lời một kiểu khác nhau.

### Câu 1.3 — Đánh đổi chi phí
Kịch bản: 10.000 người dùng hoạt động mỗi ngày, mỗi người gọi API 3 lần,
mỗi lần trung bình ~350 token đầu ra.

**Ước tính GPT-4o đắt hơn GPT-4o-mini bao nhiêu lần cho workload này? Nêu một
trường hợp GPT-4o xứng đáng với chi phí và một trường hợp nên dùng mini:**
> Với 10.000 người dùng, 3 lượt/ngày và 350 output token/lượt thì tổng output là khoảng 10,5 triệu token/ngày. Theo bảng giá trong lab, GPT-4o đắt hơn GPT-4o-mini khoảng 16,7 lần ở output token. GPT-4o xứng đáng khi cần chất lượng lập luận hoặc diễn đạt tốt hơn, ví dụ trợ lý tư vấn nội dung quan trọng; còn mini hợp lý cho FAQ, chatbot nội bộ hoặc tác vụ khối lượng lớn cần tối ưu chi phí.

---

## Block 2 — System Prompt & Token (trả lời sau Checkpoint 2)

### Câu 2.1 — Sức mạnh của persona
Gọi `chat_with_system_prompt` hai lần với cùng câu hỏi
**"Giải thích blockchain là gì?"** nhưng hai system prompt khác nhau:
- "Bạn là giáo viên tiểu học, giải thích thật đơn giản cho trẻ 8 tuổi."
- "Bạn là chuyên gia tài chính, trả lời chuyên sâu bằng thuật ngữ kỹ thuật."

**Hai phản hồi khác nhau như thế nào (độ dài, từ vựng, ví dụ)? System prompt
ảnh hưởng đến hành vi model ra sao?** (3–4 câu)
> Persona giáo viên tiểu học thường cho câu trả lời ngắn hơn, dùng từ đơn giản và nhiều ví dụ gần gũi như “sổ cái” hay “quyển vở ghi chung”. Persona chuyên gia tài chính thì dài hơn, dùng thuật ngữ như phân tán, xác thực, bất biến dữ liệu và nhấn mạnh cơ chế vận hành. System prompt vì vậy đóng vai trò định hình giọng điệu, độ sâu chuyên môn và kiểu ví dụ mà model chọn để trả lời cùng một câu hỏi.

### Câu 2.2 — tiktoken vs đếm từ
Chọn một đoạn văn tiếng Việt ~100 từ. So sánh số token theo `count_tokens`
(tiktoken) với ước lượng `số từ / 0.75` mà Part 1 đã dùng.

**Hai con số chênh nhau bao nhiêu phần trăm? Vì sao tiếng Việt thường tốn
nhiều token hơn tiếng Anh cùng độ dài?**
> Nếu lấy một đoạn khoảng 100 từ tiếng Việt thì `count_tokens` thường ra cao hơn ước lượng `số từ / 0.75`, và mức chênh vài phần trăm đến vài chục phần trăm là bình thường tùy dấu câu, từ ghép và tên riêng. Tiếng Việt thường tốn token hơn tiếng Anh cùng độ dài vì nhiều âm tiết được viết cách nhau bằng dấu cách, dấu thanh và cấu trúc từ khiến tokenizer khó gộp thành các token dài, nên số token thực tế dễ tăng hơn.

---

## Block 3 — Streaming & Độ Bền (trả lời sau Checkpoint 3)

### Câu 3.1 — Trải nghiệm người dùng với streaming
**Streaming quan trọng nhất trong trường hợp nào, và khi nào thì
non-streaming lại phù hợp hơn?** (1 đoạn văn)
> Streaming quan trọng nhất khi phản hồi dài hoặc thời gian suy luận đủ lớn để người dùng phải chờ, vì nó tạo cảm giác hệ thống đang làm việc ngay lập tức và giảm độ khó chịu khi đợi. Với chatbot, trợ lý học tập hay công cụ viết nội dung, việc thấy câu trả lời hiện dần từng phần cải thiện UX rất rõ. Ngược lại, non-streaming phù hợp hơn khi câu trả lời rất ngắn, khi giao diện cần xử lý toàn bộ kết quả rồi mới hiển thị, hoặc khi downstream chỉ cần một payload hoàn chỉnh để lưu log, kiểm duyệt hay parse JSON.

### Câu 3.2 — Vì sao backoff theo cấp số nhân?
**So với delay cố định (ví dụ luôn chờ 1 giây), exponential backoff có lợi
thế gì khi API bị quá tải? Điều gì xảy ra nếu hàng nghìn client cùng retry
với delay cố định giống nhau?**
> Exponential backoff giúp giảm áp lực lên server đang nghẽn vì mỗi lần retry sẽ giãn ra xa hơn, cho hệ thống có thời gian hồi phục thay vì bị dội request liên tục. So với delay cố định, nó thích nghi tốt hơn với lỗi tạm thời kéo dài. Nếu hàng nghìn client cùng retry với một delay cố định giống nhau, họ rất dễ bắn request lại cùng lúc theo từng đợt, tạo hiệu ứng “thundering herd” và làm tình trạng quá tải kéo dài hơn.

---

## Block 4 — Mini-Project (trả lời sau Checkpoint 4)

### Câu 4.1 — Thiết kế persona
**Bạn chọn persona gì cho trợ lý của mình? Viết lại system prompt đó và giải
thích 1–2 lựa chọn từ ngữ quan trọng trong prompt (ví dụ: vì sao yêu cầu
"trả lời ngắn gọn", vì sao chỉ định ngôn ngữ...):**
> Mình chọn persona: “Bạn là trợ giảng thân thiện của khóa AI, trả lời ngắn gọn bằng tiếng Việt.” Cụm “trợ giảng thân thiện” giúp giọng điệu gần gũi, hỗ trợ người học tốt hơn thay vì trả lời khô cứng. Cụm “ngắn gọn” giúp kiểm soát độ dài và chi phí, còn “bằng tiếng Việt” giữ trải nghiệm nhất quán cho đúng bối cảnh lớp học.

### Câu 4.2 — Hạn chế & cải thiện
**Trợ lý của bạn hiện có hạn chế lớn nhất là gì (ví dụ: history chỉ 3 lượt,
không có bộ nhớ dài hạn, không kiểm duyệt nội dung...)? Đề xuất một cải
thiện cụ thể và mô tả ngắn cách triển khai:**
> Hạn chế lớn nhất hiện tại là trợ lý chỉ nhớ tối đa 3 lượt gần nhất nên rất dễ mất ngữ cảnh khi hội thoại dài hơn hoặc khi người dùng quay lại một chủ đề cũ. Một cải thiện cụ thể là thêm bước tóm tắt hội thoại cũ: khi history vượt ngưỡng, tạo một summary ngắn rồi lưu summary đó như một message hệ thống hoặc context bổ sung. Cách này giữ được thông tin quan trọng lâu hơn mà vẫn kiểm soát số token input mỗi lượt.

---

## Danh Sách Kiểm Tra Nộp Bài

- [ ] `python grade.py` — xem điểm tự động, mục tiêu ≥ 75/100
- [ ] Cả 4 checkpoint pytest đều pass
- [ ] Tất cả 9 câu trong file này đã được trả lời
- [ ] Đã copy bài làm vào folder `solution/` và zip theo hướng dẫn README

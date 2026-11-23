export type Story = {
  slug: string
  title: string
  category: string
  excerpt: string
  image: string
  alt: string
  intro: string
  sections: { title: string; text: string }[]
  productCategory: string
}

export const stories: Story[] = [
  {
    slug: 'mot-buoi-sang-khong-voi',
    title: 'Một buổi sáng, chẳng cần vội đi đâu.',
    category: 'NHỊP SỐNG CHẬM',
    excerpt:
      'Đặt điện thoại xuống. Đợi tách trà nguội bớt. Đôi khi, một ngày dễ thương bắt đầu rất đơn giản.',
    image: '/images/slow-living/lifestyle.jpg',
    alt: 'Bàn ăn sáng có gốm, cuốn sách và ánh nắng bên cửa sổ',
    intro:
      'Không phải buổi sáng nào cũng có nhiều thời gian. Nhưng mình vẫn có thể giữ lại vài phút để bắt đầu một ngày theo cách dịu dàng hơn. Chẳng cần một lịch trình hoàn hảo, chỉ cần một khoảng nhỏ dành cho chính mình.',
    sections: [
      {
        title: 'Bắt đầu bằng điều mình đã có',
        text: 'Kéo rèm cửa, rót một cốc nước, dọn một khoảng nhỏ trên bàn. Đó có thể là chiếc bàn làm việc quen thuộc hoặc góc bếp còn thơm mùi cà phê. Mình không cần một căn nhà thật rộng để có một buổi sáng dễ chịu. Đôi khi, việc cất bớt vài món đồ đã đủ để ánh sáng và sự thảnh thơi có chỗ ghé vào.',
      },
      {
        title: 'Một chiếc cốc mình muốn cầm mỗi ngày',
        text: 'Có người thích một chiếc cốc tròn nằm gọn trong hai tay. Có người thích quai lớn, có người lại thương một sắc men xanh thật nhạt. Hãy bắt đầu từ cách mình thường dùng, rồi mới đến màu và dáng. Nếu mua để đựng thực phẩm hoặc đồ uống, cần kiểm tra thông tin sử dụng đã được xác nhận cho đúng sản phẩm; vẻ ngoài của lớp men không thay thế được thông tin ấy.',
      },
      {
        title: 'Để buổi sáng có một nhịp riêng',
        text: 'Đọc một trang sách thay vì lướt thêm một màn hình. Nhìn ra ngoài cửa sổ trong lúc chờ bánh. Viết một việc mình muốn làm thật tử tế hôm nay. Sống chậm không nhất thiết phải làm ít đi; với Nàng, đó là dành sự chú ý trọn vẹn hơn cho một điều đang ở ngay trước mắt.',
      },
    ],
    productCategory: 'Cốc & tách',
  },
  {
    slug: 'mot-nhanh-hoa-mot-goc-nha',
    title: 'Một nhành hoa cũng đủ làm nhà khác đi.',
    category: 'THƯƠNG MỘT GÓC NHÀ',
    excerpt:
      'Chọn một chiếc bình vừa vặn, cắm ít hoa thôi, rồi để khoảng trống kể phần còn lại của câu chuyện.',
    image: '/images/nang-gom/flowers.jpg',
    alt: 'Bình gốm cắm hoa trắng bên ghế đọc sách và bàn gỗ',
    intro:
      'Có những hôm mình không muốn thay đổi cả căn phòng, chỉ muốn nó dịu hơn một chút. Một chiếc bình, vài nhành hoa và một góc đủ ánh sáng có thể là khởi đầu thật vừa vặn.',
    sections: [
      {
        title: 'Chọn góc trước, chọn bình sau',
        text: 'Hãy nhìn nơi chiếc bình sẽ ở lại: một kệ sách thấp, bàn cạnh ghế hay góc bàn ăn. Mặt bàn nhỏ thường hợp với một điểm nhấn gọn gàng. Trên kệ rộng, mình có thể thử một dáng bình rõ nét hơn. Đặt món đồ lên và lùi lại vài bước; cảm giác cân bằng trong chính căn phòng luôn hữu ích hơn một quy tắc cứng nhắc.',
      },
      {
        title: 'Đừng vội lấp đầy khoảng trống',
        text: 'Một cành có dáng đẹp đôi khi đã đủ. Hãy để các nhành nghiêng theo hướng tự nhiên, thử xoay chiếc bình rồi nhìn lại từ nơi mình thường ngồi. Nếu chưa rõ chiếc bình có phù hợp để chứa nước không, hoa khô hoặc nhành trang trí là cách thử bố cục không cần giả định tính năng của sản phẩm.',
      },
      {
        title: 'Để màu đất nói chuyện với căn nhà',
        text: 'Sắc đất ấm thường gợi cảm giác gần gũi khi đặt bên gỗ, vải thô hoặc trang sách. Men ngà có thể tạo một khoảng nhẹ nhàng giữa những vật dụng nhiều màu. Không cần mọi thứ cùng một tông: một điểm khác biệt nhỏ, được chọn vì mình thật sự thích, thường làm góc nhà có cá tính hơn.',
      },
    ],
    productCategory: 'Bình hoa',
  },
  {
    slug: 'mon-qua-mang-theo-loi-thuong',
    title: 'Có những lời thương được gói bằng gốm.',
    category: 'GỬI MỘT CHÚT QUAN TÂM',
    excerpt:
      'Món quà đáng nhớ đôi khi là món đồ người nhận muốn dùng trong một ngày rất đỗi bình thường.',
    image: '/images/nang-gom/gift.jpg',
    alt: 'Hộp quà hai cốc gốm, giấy kraft, ruy băng vải và nhành hoa khô',
    intro:
      'Một món quà không nhất thiết phải thật lớn. Có khi, điều khiến người nhận vui nhất là cảm giác: à, người tặng đã nhớ một thói quen rất nhỏ của mình.',
    sections: [
      {
        title: 'Nhớ về người nhận, trước khi chọn món quà',
        text: 'Người ấy có thích pha trà vào cuối tuần không? Có thường mang một nhành hoa về nhà, hay luôn tìm một chiếc cốc vừa tay? Bắt đầu từ những điều như thế sẽ giúp mình chọn món đồ có cơ hội trở thành một phần trong cuộc sống của họ, thay vì chỉ là một vật trang trí đẹp trong ngày nhận quà.',
      },
      {
        title: 'Chọn vừa đủ, và để lại một lời riêng',
        text: 'Một chiếc cốc có thể là món quà tự dành cho bản thân. Một cặp tách gợi một cuộc hẹn ngồi lại. Một chiếc bình nhỏ có thể mang theo lời chúc cho một ngôi nhà mới. Thêm vài dòng viết tay: vì sao mình nhớ đến người ấy khi nhìn thấy món gốm này. Những lời thật thường không cần dài.',
      },
      {
        title: 'Nâng niu cả hành trình đến tay người nhận',
        text: 'Gốm cần được bảo vệ phù hợp trong quá trình vận chuyển. Khi chọn mua, hãy hỏi rõ cách đóng gói, điều kiện giao nhận và cách xử lý khi hàng gặp vấn đề, thay vì tự suy đoán từ ảnh hộp quà.',
      },
    ],
    productCategory: 'Bộ sưu tập',
  },
]

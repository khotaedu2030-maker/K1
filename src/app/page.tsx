const audiences = [
  {
    number: "01",
    title: "الأطفال والطلاب",
    text: "نبني المهارات التي تساعد الطالب على التعلم والتنظيم والاستقلالية.",
  },
  {
    number: "02",
    title: "طلاب الجامعات",
    text: "دعم عملي للانتقال إلى حياة جامعية أكثر استقلالًا وتنظيمًا.",
  },
  {
    number: "03",
    title: "البالغون",
    text: "مهارات تساعدك على إدارة الوقت والأولويات والمهام اليومية.",
  },
  {
    number: "04",
    title: "المدارس والجهات التعليمية",
    text: "حلول وبرامج لتطوير مهارات الطلاب ودعم البيئة التعليمية.",
  },
];

const services = [
  {
    icon: "◎",
    title: "التقييم وفهم الاحتياج",
    text: "نبدأ بفهم الطالب واحتياجاته ونقاط القوة والتحديات التي تواجهه.",
  },
  {
    icon: "↗",
    title: "خطة فردية",
    text: "نحوّل نتائج التقييم إلى خطة واضحة تناسب احتياجات كل مستفيد.",
  },
  {
    icon: "◌",
    title: "التدريب على المهارات",
    text: "تدريب عملي على التنظيم وإدارة الوقت والتخطيط والتركيز والبدء بالمهام.",
  },
  {
    icon: "✓",
    title: "المتابعة المستمرة",
    text: "نراجع التقدم ونعدّل الخطة عند الحاجة حتى تستمر المهارات وتتطور.",
  },
  {
    icon: "♡",
    title: "دعم الأسرة",
    text: "نساعد الأسرة على فهم الاحتياج وبناء بيئة تساعد على الاستقلالية.",
  },
  {
    icon: "▣",
    title: "دعم المؤسسات التعليمية",
    text: "برامج وخدمات مخصصة للمدارس والجامعات والجهات التعليمية.",
  },
];

const skills = [
  "إدارة الوقت",
  "التخطيط",
  "التنظيم",
  "التركيز والانتباه",
  "البدء بالمهام",
  "إدارة المشتتات",
  "الذاكرة العاملة",
  "المرونة",
  "تحديد الأولويات",
  "حل المشكلات",
  "الاستقلالية",
  "المهارات الأكاديمية",
];

const journey = [
  {
    step: "01",
    title: "نبدأ بفهمك",
    text: "نتعرف على احتياجك وأهدافك والتحديات التي تواجهك.",
  },
  {
    step: "02",
    title: "نقيّم الاحتياج",
    text: "نحدد المهارات التي تحتاج إلى تطوير بصورة عملية.",
  },
  {
    step: "03",
    title: "نبني خطتك",
    text: "نضع خطة فردية واضحة بأهداف قابلة للمتابعة والقياس.",
  },
  {
    step: "04",
    title: "نتدرب معًا",
    text: "نحوّل المهارات إلى ممارسات عملية داخل الدراسة والحياة اليومية.",
  },
  {
    step: "05",
    title: "نتابع تقدمك",
    text: "نراجع النتائج باستمرار ونطوّر الخطة وفق احتياجك.",
  },
];

const resources = [
  {
    type: "مقالات",
    title: "كيف تساعد ابنك على بناء عادات دراسية أفضل؟",
    text: "أفكار عملية تساعد الأسرة على دعم التنظيم والاستقلالية.",
  },
  {
    type: "أدلة",
    title: "دليل الطالب لتنظيم أسبوعه الدراسي",
    text: "طريقة بسيطة لتحويل المهام والأهداف إلى خطة أسبوعية.",
  },
  {
    type: "أدوات",
    title: "قائمة التحقق قبل بدء المهمة",
    text: "أداة عملية تساعد الطالب على البدء والاستمرار وإنهاء المهام.",
  },
];

function KhotaLogo() {
  return (
    <div className="khota-logo" aria-label="خُطى">
      <div className="khota-mark">
        <span className="khota-star">✦</span>
        <span className="step step-one" />
        <span className="step step-two" />
        <span className="step step-three" />
      </div>

      <div className="khota-word">
        <strong>خُطى</strong>
        <small>KHOTA</small>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="khota-site">
      {/* =========================
          HEADER
      ========================== */}
      <header className="khota-header">
        <div className="khota-container header-inner">
          <a href="#" className="logo-link">
            <KhotaLogo />
          </a>

          <nav className="khota-nav">
            <a href="#why">لماذا خُطى؟</a>
            <a href="#services">خدماتنا</a>
            <a href="#audiences">لمن نساعد؟</a>
            <a href="#journey">كيف نعمل؟</a>
            <a href="#resources">الموارد</a>
          </nav>

          <div className="header-actions">
            <a href="#login" className="login-link">
              تسجيل الدخول
            </a>

            <a href="#booking" className="khota-button khota-button-small">
              ابدأ مع خُطى
            </a>
          </div>
        </div>
      </header>

      {/* =========================
          HERO
      ========================== */}
      <section className="khota-hero">
        <div className="khota-container hero-grid">
          <div className="hero-content">
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              خطوة. بثقة. نحو التميز.
            </div>

            <h1>
              لكل طالب
              <span> خطوة مختلفة.</span>
              <br />
              ونحن نساعده على
              <br />
              اكتشافها.
            </h1>

            <p className="hero-description">
              في خُطى، نبدأ بفهم الطالب واحتياجه، ثم نبني معه مسارًا
              تعليميًا يساعده على التعلم بثقة، وتطوير مهاراته، وتحقيق تقدم
              حقيقي.
            </p>

            <div className="hero-buttons">
              <a href="#booking" className="khota-button">
                ابدأ خطواتك ←
              </a>

              <a href="#how" className="khota-button khota-button-outline">
                اكتشف كيف نساعد
              </a>
            </div>

            <div className="hero-points">
              <span>✓ خطة فردية</span>
              <span>✓ متابعة مستمرة</span>
              <span>✓ تعلم عملي</span>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-glow glow-one" />
            <div className="hero-glow glow-two" />

            <div className="student-card">
              <div className="student-card-top">
                <span>رحلة الطالب</span>
                <span className="status-pill">تقدم مستمر</span>
              </div>

              <div className="student-card-label">الهدف</div>
              <h3>أتعلم بثقة واستقلالية</h3>

              <div className="progress-task">
                <div className="task-number teal">01</div>
                <div className="task-info">
                  <strong>التركيز</strong>
                  <small>مهارة أساسية</small>
                </div>
                <span>✓</span>
              </div>

              <div className="progress-task">
                <div className="task-number yellow">02</div>
                <div className="task-info">
                  <strong>تنظيم الوقت</strong>
                  <small>قيد التطوير</small>
                </div>
                <span>✓</span>
              </div>

              <div className="progress-task">
                <div className="task-number coral">03</div>
                <div className="task-info">
                  <strong>التخطيط</strong>
                  <small>الخطوة القادمة</small>
                </div>
                <span>→</span>
              </div>

              <div className="progress-label">
                <span>التقدم</span>
                <strong>72%</strong>
              </div>

              <div className="progress-bar">
                <span />
              </div>
            </div>

            <div className="floating-badge">
              <span>✦</span>
              <div>
                <strong>خُطى</strong>
                <small>Step by step</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================
          WHY KHOTA
      ========================== */}
      <section id="why" className="khota-section why-section">
        <div className="khota-container">
          <div className="section-intro centered">
            <span className="section-kicker">لماذا خُطى؟</span>
            <h2>
              ليس كل تحدٍ دراسي يحتاج
              <span> إلى مزيد من الساعات.</span>
            </h2>
            <p>
              أحيانًا يحتاج الطالب إلى طريقة مختلفة للتعلم، وتنظيم وقته،
              وبناء ثقته، وتحويل ما يعرفه إلى ممارسة مستمرة.
            </p>
          </div>

          <div className="feature-grid">
            <article className="feature-card">
              <span className="feature-icon">01</span>
              <h3>نفهم الطالب</h3>
              <p>
                نبدأ من احتياج الطالب الحقيقي بدلًا من افتراض أن الحل واحد
                للجميع.
              </p>
            </article>

            <article className="feature-card featured">
              <span className="feature-icon">02</span>
              <h3>نبني خطة فردية</h3>
              <p>
                لكل طالب أهدافه وطريقته وسرعته، لذلك نبني مسارًا يناسبه.
              </p>
            </article>

            <article className="feature-card">
              <span className="feature-icon">03</span>
              <h3>نحوّل المهارة إلى عادة</h3>
              <p>
                التدريب لا يتوقف عند المعرفة، بل نركز على الممارسة اليومية.
              </p>
            </article>

            <article className="feature-card">
              <span className="feature-icon">04</span>
              <h3>نقيس التقدم</h3>
              <p>
                نتابع التطور ونراجع الأهداف ونحدث الخطة حسب النتائج.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* =========================
          AUDIENCES
      ========================== */}
      <section id="audiences" className="khota-section audiences-section">
        <div className="khota-container">
          <div className="section-heading-row">
            <div>
              <span className="section-kicker">لمن نساعد؟</span>
              <h2>
                خُطى تبدأ معك
                <br />
                <span>في المرحلة التي أنت فيها.</span>
              </h2>
            </div>

            <p>
              لأن الاحتياجات تختلف من طالب إلى آخر، نقدم برامجنا وخدماتنا
              بطريقة تناسب المرحلة والأهداف.
            </p>
          </div>

          <div className="audience-grid">
            {audiences.map((item) => (
              <a href="#services" className="audience-card" key={item.number}>
                <div className="audience-number">{item.number}</div>

                <div className="audience-arrow">←</div>

                <h3>{item.title}</h3>
                <p>{item.text}</p>

                <span className="card-link">اكتشف المسار ←</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* =========================
          SERVICES
      ========================== */}
      <section id="services" className="khota-section services-section">
        <div className="khota-container">
          <div className="section-intro">
            <span className="section-kicker">الخدمات والبرامج</span>

            <h2>
              من فهم الاحتياج
              <br />
              <span>إلى بناء المهارة.</span>
            </h2>

            <p>
              صممنا خدمات خُطى لتكون عملية ومترابطة، بحيث ينتقل المستفيد
              من الفهم والتقييم إلى التدريب والمتابعة.
            </p>
          </div>

          <div className="services-grid">
            {services.map((service, index) => (
              <article className="service-card" key={service.title}>
                <div className="service-top">
                  <span className="service-icon">{service.icon}</span>
                  <span className="service-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>

                <h3>{service.title}</h3>
                <p>{service.text}</p>

                <a href="#booking">اعرف المزيد ←</a>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* =========================
          SKILLS
      ========================== */}
      <section className="skills-section">
        <div className="khota-container skills-layout">
          <div className="skills-content">
            <span className="section-kicker">المهارات التنفيذية</span>

            <h2>
              مهارات صغيرة
              <br />
              تصنع <span>فرقًا كبيرًا.</span>
            </h2>

            <p>
              المهارات التنفيذية تساعدنا على البدء، والتنظيم، والتخطيط،
              وإدارة الوقت، والتركيز، واتخاذ القرارات. وهي مهارات يمكن
              تعلمها وتطويرها بالممارسة الصحيحة.
            </p>

            <a href="#booking" className="khota-button">
              اكتشف المسار المناسب
            </a>
          </div>

          <div className="skills-list">
            {skills.map((skill, index) => (
              <div className="skill-item" key={skill}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{skill}</strong>
                <b>↗</b>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================
          JOURNEY
      ========================== */}
      <section id="journey" className="khota-section journey-section">
        <div className="khota-container">
          <div className="section-heading-row">
            <div>
              <span className="section-kicker">رحلة خُطى</span>
              <h2>
                خطوات واضحة.
                <br />
                <span>وتقدم يمكن ملاحظته.</span>
              </h2>
            </div>

            <p>
              لا نبحث عن حلول مؤقتة؛ نبني مع المستفيد مهارات قابلة للاستخدام
              في الدراسة والعمل والحياة اليومية.
            </p>
          </div>

          <div className="journey-line">
            {journey.map((item, index) => (
              <div className="journey-step" key={item.step}>
                <div className="journey-number">{item.step}</div>

                {index !== journey.length - 1 && (
                  <div className="journey-connector" />
                )}

                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================
          CTA
      ========================== */}
      <section id="booking" className="booking-section">
        <div className="khota-container">
          <div className="booking-box">
            <div>
              <span className="booking-kicker">خطوتك الأولى</span>

              <h2>جاهز تبدأ رحلة مختلفة مع خُطى؟</h2>

              <p>
                أخبرنا عن احتياج الطالب، وسنساعدك على اكتشاف المسار الأنسب
                للبدء.
              </p>
            </div>

            <a href="#contact" className="khota-button khota-button-yellow">
              احجز خطواتك الآن ←
            </a>
          </div>
        </div>
      </section>

      {/* =========================
          RESOURCES
      ========================== */}
      <section id="resources" className="khota-section resources-section">
        <div className="khota-container">
          <div className="section-heading-row">
            <div>
              <span className="section-kicker">الموارد</span>

              <h2>
                محتوى يساعدك
                <br />
                <span>على التقدم.</span>
              </h2>
            </div>

            <a href="#resources" className="text-link">
              جميع الموارد ←
            </a>
          </div>

          <div className="resources-grid">
            {resources.map((resource) => (
              <article className="resource-card" key={resource.title}>
                <div className="resource-image">
                  <span>{resource.type}</span>
                </div>

                <div className="resource-content">
                  <small>{resource.type}</small>
                  <h3>{resource.title}</h3>
                  <p>{resource.text}</p>
                  <a href="#resources">اقرأ المزيد ←</a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* =========================
          FINAL CTA
      ========================== */}
      <section id="contact" className="final-cta">
        <div className="khota-container">
          <div className="final-cta-inner">
            <div className="final-logo">
              <KhotaLogo />
            </div>

            <div>
              <span className="section-kicker">خطوتك تبدأ هنا</span>
              <h2>لا تحتاج أن تعرف كل الخطوات الآن.</h2>
              <p>نساعدك على معرفة الخطوة القادمة.</p>
            </div>

            <a href="#booking" className="khota-button">
              ابدأ مع خُطى ←
            </a>
          </div>
        </div>
      </section>

      {/* =========================
          FOOTER
      ========================== */}
      <footer className="khota-footer">
        <div className="khota-container">
          <div className="footer-grid">
            <div className="footer-brand">
              <KhotaLogo />

              <p>
                خطوة. بثقة. نحو التميز.
                <br />
                نساعد الطلاب على بناء المهارات التي تقودهم إلى الاستقلالية
                والتقدم.
              </p>
            </div>

            <div className="footer-column">
              <h4>خدماتنا</h4>
              <a href="#services">التقييم</a>
              <a href="#services">الخطة الفردية</a>
              <a href="#services">التدريب</a>
              <a href="#services">المتابعة</a>
            </div>

            <div className="footer-column">
              <h4>لمن نساعد؟</h4>
              <a href="#audiences">الطلاب</a>
              <a href="#audiences">طلاب الجامعات</a>
              <a href="#audiences">البالغون</a>
              <a href="#audiences">المدارس</a>
            </div>

            <div className="footer-column">
              <h4>تواصل معنا</h4>
              <a href="#contact">احجز موعدًا</a>
              <a href="#resources">الموارد</a>
              <a href="#contact">تواصل معنا</a>
              <a href="#login">تسجيل الدخول</a>
            </div>
          </div>

          <div className="footer-bottom">
            <span>© 2026 خُطى التعليمية. جميع الحقوق محفوظة.</span>
            <span>KHOTA — Step by step. With confidence.</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
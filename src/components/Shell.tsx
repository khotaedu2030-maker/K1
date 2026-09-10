import Header from "./Header";
import Footer from "./Footer";

export default function Shell({
  children,
  transparentHeader = false,
}: {
  children: React.ReactNode;
  transparentHeader?: boolean;
}) {
  return (
    <>
      <a href="#main-content" className="skip-link">تخطَّ إلى المحتوى الرئيسي</a>
      <Header transparent={transparentHeader} />
      <div id="main-content">{children}</div>
      <Footer />
    </>
  );
}

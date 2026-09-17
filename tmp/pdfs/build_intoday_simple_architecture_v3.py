from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, white
import math

OUT='output/pdf/intoday-simple-architecture.pdf'
pdfmetrics.registerFont(TTFont('NotoSC',r'C:\Windows\Fonts\NotoSansSC-VF.ttf'))
W,H=landscape(A4)
NAVY=HexColor('#12203A');SLATE=HexColor('#5B677A');BLUE=HexColor('#2563EB');BLUEL=HexColor('#EAF2FF')
PURPLE=HexColor('#7C3AED');PURPLEL=HexColor('#F2EBFF');ORANGE=HexColor('#EA580C');ORANGEL=HexColor('#FFF0E6')
GREEN=HexColor('#059669');GREENL=HexColor('#E5F8F0');LINE=HexColor('#D9E1EC');BG=HexColor('#F8FAFD')
def txt(c,s,x,y,size=10,color=NAVY,align='center'):
    c.setFont('NotoSC',size);c.setFillColor(color)
    {'left':c.drawString,'right':c.drawRightString,'center':c.drawCentredString}[align](x,y,s)
def box(c,x,y,w,h,title,details,fill,stroke):
    c.setFillColor(fill);c.setStrokeColor(stroke);c.setLineWidth(1.5);c.roundRect(x,y,w,h,15,fill=1,stroke=1)
    txt(c,title,x+w/2,y+h-32,15,stroke)
    for i,row in enumerate(details):txt(c,row,x+w/2,y+h-55-i*16,9,SLATE)
def arrow(c,x1,y1,x2,y2,color,label=None):
    c.saveState();c.setStrokeColor(color);c.setFillColor(color);c.setLineWidth(2);c.line(x1,y1,x2,y2)
    a=math.atan2(y2-y1,x2-x1)
    for d in (2.55,-2.55):c.line(x2,y2,x2-9*math.cos(a+d),y2-9*math.sin(a+d))
    c.restoreState()
    if label:txt(c,label,(x1+x2)/2,(y1+y2)/2+10,8,color)
def band(c,y,label,color):
    c.setStrokeColor(color);c.setLineWidth(1);c.setDash(5,4);c.line(42,y,800,y);c.setDash();txt(c,label,42,y+10,9,color,align='left')
def build():
    c=canvas.Canvas(OUT,pagesize=landscape(A4));c.setTitle('IntoDay - Simple Architecture')
    c.setFillColor(BG);c.rect(0,0,W,H,fill=1,stroke=0)
    txt(c,'IntoDay 技术架构',42,H-52,26,NAVY,align='left')
    txt(c,'面试说明版：只保留实际运行所需的主流程',43,H-73,10,SLATE,align='left')

    # Row 1: user access and session.
    band(c,371,'① 访问与认证',BLUE)
    box(c,55,240,120,90,'用户浏览器',['访问 intoday.cc','或 app.intoday.cc'],BLUEL,BLUE)
    box(c,230,240,120,90,'Vercel',['静态 React 应用','PWA / API'],BLUEL,BLUE)
    box(c,405,240,140,90,'React + Vite',['main.jsx → App.jsx','DesktopApp.jsx'],PURPLEL,PURPLE)
    box(c,620,240,140,90,'Supabase Auth',['Google OAuth','Session'],GREENL,GREEN)
    arrow(c,175,285,230,285,BLUE,'请求')
    arrow(c,350,285,405,285,BLUE,'加载 SPA')
    arrow(c,545,285,620,285,GREEN,'认证 / Session')

    # Row 2: task data. No diagonal/crossing arrows.
    band(c,205,'② 任务数据：本地优先，然后自动同步',ORANGE)
    box(c,55,85,150,90,'Desktop 功能',['Canvas / Capture','Inbox / Pack / Workspace'],PURPLEL,PURPLE)
    box(c,270,85,150,90,'useSyncedTodos',['React hook','350ms debounce'],ORANGEL,ORANGE)
    box(c,485,85,150,90,'浏览器本地存储',['localStorage：任务、Workspace','IndexedDB：上传 Blob'],ORANGEL,ORANGE)
    box(c,690,85,110,90,'Postgres todos',['任务 payload','RLS 用户隔离'],GREENL,GREEN)
    arrow(c,205,130,270,130,PURPLE,'变更任务')
    arrow(c,420,130,485,130,ORANGE,'立即保存')
    arrow(c,635,130,690,130,GREEN,'同步 / 恢复')

    # Minimal facts useful for speaking, not a second graph.
    c.setFillColor(white);c.setStrokeColor(LINE);c.roundRect(42,28,758,35,10,fill=1,stroke=1)
    txt(c,'要点：Canvas 是 DOM 卡片 + 原生 Pointer Events；任务会同步，但 Workspace 与上传文件目前主要保留在浏览器本地。',60,42,9,NAVY,align='left')
    c.showPage();c.save()
if __name__=='__main__':build()

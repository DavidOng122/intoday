from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, white
import math

OUT='output/pdf/intoday-real-architecture.pdf'
pdfmetrics.registerFont(TTFont('NotoSC',r'C:\Windows\Fonts\NotoSansSC-VF.ttf'))
W,H=landscape(A4)
NAVY=HexColor('#12203A'); SLATE=HexColor('#5B677A'); BLUE=HexColor('#2563EB'); BLUEL=HexColor('#EAF2FF')
PURPLE=HexColor('#7C3AED'); PURPLEL=HexColor('#F2EBFF'); ORANGE=HexColor('#EA580C'); ORANGEL=HexColor('#FFF0E6')
GREEN=HexColor('#059669'); GREENL=HexColor('#E5F8F0'); GRAY=HexColor('#64748B'); LINE=HexColor('#D9E1EC'); BG=HexColor('#F8FAFD')

def txt(c,s,x,y,size=10,color=NAVY,align='center'):
    c.setFont('NotoSC',size); c.setFillColor(color)
    {'left':c.drawString,'right':c.drawRightString,'center':c.drawCentredString}[align](x,y,s)

def box(c,x,y,w,h,title,details,fill,stroke,title_size=13):
    c.setFillColor(fill);c.setStrokeColor(stroke);c.setLineWidth(1.35);c.roundRect(x,y,w,h,11,fill=1,stroke=1)
    txt(c,title,x+w/2,y+h-24,title_size,stroke)
    for i,row in enumerate(details):txt(c,row,x+w/2,y+h-45-i*13,7.8,SLATE)

def arrow(c,x1,y1,x2,y2,color,label=None,dashed=False):
    c.saveState();c.setStrokeColor(color);c.setFillColor(color);c.setLineWidth(1.65)
    if dashed:c.setDash(4,3)
    c.line(x1,y1,x2,y2); a=math.atan2(y2-y1,x2-x1)
    for d in (0.45,-0.45):c.line(x2,y2,x2-7*math.cos(a+d),y2-7*math.sin(a+d))
    c.restoreState()
    if label: txt(c,label,(x1+x2)/2,(y1+y2)/2+6,7.1,color)

def row_label(c, y, label, color):
    c.setStrokeColor(color);c.setLineWidth(1);c.setDash(4,3);c.line(42,y,800,y);c.setDash()
    txt(c,label,43,y+8,8.5,color,align='left')

def build():
    c=canvas.Canvas(OUT,pagesize=landscape(A4));c.setTitle('IntoDay - Real Architecture')
    c.setFillColor(BG);c.rect(0,0,W,H,fill=1,stroke=0)
    txt(c,'IntoDay 真实架构图',42,H-43,24,NAVY,align='left')
    txt(c,'依据当前 repository：src/App.jsx、src/pages/DesktopApp.jsx、相关 hooks、Supabase migrations',43,H-62,8.7,SLATE,align='left')

    # Row 1: runtime and login only.
    row_label(c, 434, '1. 运行与认证路径', BLUE)
    box(c,55,362,112,52,'浏览器',['intoday.cc / app.intoday.cc'],BLUEL,BLUE)
    box(c,205,362,112,52,'Vercel',['静态 SPA + API functions'],BLUEL,BLUE)
    box(c,355,362,130,52,'App.jsx',['读取 / 订阅 Session'],PURPLEL,PURPLE)
    box(c,610,362,135,52,'Supabase Auth',['Google OAuth / Session'],GREENL,GREEN)
    arrow(c,167,388,205,388,BLUE,'访问')
    arrow(c,317,388,355,388,BLUE,'加载')
    arrow(c,485,388,610,388,GREEN,'signInWithOAuth')

    # Row 2: application state and task data only.
    row_label(c, 332, '2. 核心任务数据路径（默认会同步）', ORANGE)
    box(c,55,244,142,60,'DesktopApp.jsx',['主要页面协调层','Canvas / Capture / Inbox / Pack'],PURPLEL,PURPLE)
    box(c,235,244,145,60,'useSyncedTodos',['React state + localStorage','350ms debounce'],ORANGEL,ORANGE)
    box(c,418,244,145,60,'todos 表',['user_id / todo_id','payload JSONB / is_deleted'],GREENL,GREEN)
    box(c,601,244,144,60,'RLS policies',['只能操作自己的 todos','Postgres 层用户隔离'],GREENL,GREEN)
    arrow(c,197,274,235,274,PURPLE,'任务变更')
    arrow(c,380,274,418,274,ORANGE,'自动同步 / hydrate')
    arrow(c,563,274,601,274,GREEN,'受策略保护')

    # Row 3: explicitly separate non-task persistence, avoiding misleading cloud claims.
    row_label(c, 214, '3. 其他实际持久化边界', GRAY)
    box(c,55,123,164,60,'Workspace state',['useDesktopWorkspaces','localStorage；当前不做云同步'],ORANGEL,ORANGE)
    box(c,253,123,164,60,'上传文件 Blob',['uploadedFileStorage','IndexedDB；当前仅本机保存'],ORANGEL,ORANGE)
    box(c,451,123,164,60,'Canvas connections',['useDesktopConnections','本地快照 / pending queue'],ORANGEL,ORANGE)
    box(c,649,123,120,60,'canvas_connections',['仅开启 feature flag','才会云同步'],GREENL,GREEN)
    arrow(c,615,153,649,153,GREEN,'可选',dashed=True)

    # Feature layer reference.
    c.setFillColor(white);c.setStrokeColor(LINE);c.roundRect(42,45,758,52,9,fill=1,stroke=1)
    txt(c,'Canvas：DOM absolute-position 卡片；拖拽：原生 Pointer Events；碰撞：自定义矩形重叠与阈值逻辑。',59,75,8.5,NAVY,align='left')
    txt(c,'重点：不要说“所有资料都上云”。当前明确同步的是 todos；Workspace、上传 Blob，以及连接关系默认行为都有本地优先边界。',59,58,8.2,SLATE,align='left')
    c.showPage();c.save()

if __name__=='__main__':build()
